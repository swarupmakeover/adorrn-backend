import fp from 'fastify-plugin'
import { Pool } from '@neondatabase/serverless'

export default fp(async (fastify) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  fastify.decorate('db', pool)
  fastify.addHook('onClose', () => pool.end())
})
