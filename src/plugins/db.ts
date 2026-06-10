import fp from 'fastify-plugin'
import { Pool } from 'pg'

export default fp(async (fastify) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  fastify.decorate('db', pool)
  fastify.addHook('onClose', () => pool.end())
})
