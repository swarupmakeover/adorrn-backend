import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  await pool.query(`
    INSERT INTO homepage_sections (key, title, sort_order) VALUES
      ('hero', 'Hero Banners', 0),
      ('featured', 'Featured Products', 1),
      ('testimonials', 'Testimonials', 2),
      ('collections_grid', 'Collections', 3),
      ('marquee_text', 'Marquee Announcement', 4)
    ON CONFLICT (key) DO NOTHING
  `)

  console.log('Seed complete')
  await pool.end()
}

seed().catch(console.error)
