import fp from 'fastify-plugin'
import { createClerkClient, verifyToken } from '@clerk/backend'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export default fp(async (fastify) => {
  fastify.decorate('authenticate', async (request, reply) => {
    const token = request.headers.authorization?.split(' ')[1]
    if (!token) return reply.status(401).send({ error: 'Unauthorized' })
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      request.userId = payload.sub
      request.userRole = (payload as any).metadata?.role
    } catch {
      reply.status(401).send({ error: 'Invalid token' })
    }
  })

  fastify.decorate('requireAdmin', async (request, reply) => {
    await fastify.authenticate(request, reply)
    if (request.userRole !== 'admin') {
      reply.status(403).send({ error: 'Forbidden' })
    }
  })
})
