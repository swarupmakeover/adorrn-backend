import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.DATABASE_URL?.includes('neon.tech') ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  const sql = readFileSync(join(__dirname, '../migrations/001_schema.sql'), 'utf-8')
  await pool.query(sql)
  console.log('Migration complete')
  await pool.end()
}

migrate().catch(console.error)
