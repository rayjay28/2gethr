// One-off runner: applies add-notify-channels-to-places.sql directly
// against the project's own Neon database, using the same DATABASE_URL the
// app itself uses (read from .env.local) and the same @neondatabase/serverless
// driver already in package.json. Mirrors run-reminders-migration.mjs, but
// reads its SQL straight from the committed scripts/ file instead of a
// loose copy in Downloads, since there's nothing project-specific in it to
// keep out of git this time.
import { readFileSync, existsSync } from 'fs'
import { neon } from '@neondatabase/serverless'

function loadEnvLocal() {
  const candidates = ['.env.local', '.env']
  const path = candidates.find(existsSync)
  if (!path) {
    console.error('Could not find .env.local or .env in the current directory. Run this from the 2gethr project root.')
    process.exit(1)
  }
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const migrationPath = 'scripts/add-notify-channels-to-places.sql'
const raw = readFileSync(migrationPath, 'utf8')

const statements = raw
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

for (const stmt of statements) {
  try {
    await sql(stmt)
    console.log(`OK: ${stmt.split('\n')[0].slice(0, 70)}`)
  } catch (err) {
    console.error(`FAILED: ${stmt.split('\n')[0].slice(0, 70)}`)
    console.error(err.message || err)
    process.exit(1)
  }
}

console.log('\nDone - saved_places.notify_channels column is ready.')
