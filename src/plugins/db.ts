import fp from 'fastify-plugin'
import { Pool } from 'pg'

export default fp(async (fastify) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.DATABASE_URL?.includes('neon.tech') ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  fastify.decorate('db', pool)
  fastify.addHook('onClose', () => pool.end())
})
