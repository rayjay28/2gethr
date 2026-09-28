-- Adds TOTP-based two-factor authentication support for regular users.
-- (Not the same as admin_users.mfa_enabled/mfa_secret in 003-admin-schema.sql,
-- which is a separate, still-unimplemented admin-only flag.)
--
-- two_factor_secret: AES-256-GCM encrypted (see lib/encryption.ts) Base32
--   TOTP secret, only set once enrollment is confirmed with a valid code.
-- two_factor_pending_secret: encrypted secret generated during enrollment,
--   before the user has confirmed it with a valid code. Cleared on confirm
--   or on a fresh /2fa/setup call.
-- two_factor_backup_codes: SHA-256 hashes of one-time backup codes (never
--   store backup codes in plaintext). Each is removed from the array once
--   consumed.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[] NOT NULL DEFAULT '{}';
