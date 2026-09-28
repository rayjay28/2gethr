/**
 * TOTP (RFC 6238) + Base32 (RFC 4648) implementation using only Node's
 * built-in `crypto` module — no external TOTP/QR library dependency,
 * so this doesn't require an npm install to ship.
 *
 * Compatible with standard authenticator apps (Google Authenticator, Authy,
 * 1Password, etc.): 20-byte secret, SHA-1, 30-second step, 6 digits — the
 * de facto universal defaults those apps assume.
 */

import crypto from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

/** Encode raw bytes as an unpadded Base32 string (the format authenticator apps expect for secrets). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/** Decode a Base32 string (case-insensitive, padding/whitespace tolerant) back to raw bytes. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/** Generate a new random TOTP secret (20 bytes, the standard length), Base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

/**
 * Build the `otpauth://` URI that authenticator apps and QR codes use to
 * enroll an account. `accountLabel` is typically "AppName:user@email.com".
 */
export function buildOtpAuthUrl(secretBase32: string, accountLabel: string, issuer: string): string {
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${encodeURIComponent(accountLabel)}?${params.toString()}`
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32)
  const counterBuffer = Buffer.alloc(8)
  // Counter is a 64-bit big-endian integer; JS numbers are safe up to 2^53,
  // far beyond any realistic Unix-time-based counter value.
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  counterBuffer.writeUInt32BE(counter % 2 ** 32, 4)

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(binCode % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** Generate the current 6-digit TOTP code for a secret (mainly for tests/debugging). */
export function generateTotp(secretBase32: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  return hotp(secretBase32, counter)
}

/**
 * Verify a user-entered code against a secret, tolerating +/- `windowSteps`
 * time steps (default 1, i.e. +/-30s) of clock drift between the server
 * and the user's authenticator app. Uses a constant-time comparison to
 * avoid leaking match position through timing.
 */
export function verifyTotp(secretBase32: string, token: string, windowSteps: number = 1, at: number = Date.now()): boolean {
  const cleanToken = token.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleanToken)) return false

  const counter = Math.floor(at / 1000 / STEP_SECONDS)

  for (let errorWindow = -windowSteps; errorWindow <= windowSteps; errorWindow++) {
    const candidate = hotp(secretBase32, counter + errorWindow)
    const a = Buffer.from(candidate)
    const b = Buffer.from(cleanToken)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true
    }
  }

  return false
}

/** Generate `count` human-friendly one-time backup codes, e.g. "A1B2-C3D4". */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase() // 8 hex chars
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`)
  }
  return codes
}

/**
 * One-way hash for storing backup codes at rest (never store them
 * plaintext). Strips whitespace/dashes and uppercases first, so a code
 * verifies whether or not the user retypes the "-" separator.
 */
export function hashBackupCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}
