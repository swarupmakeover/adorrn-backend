import fp from 'fastify-plugin'
import { createClerkClient, verifyToken } from '@clerk/backend'

export default fp(async (fastify) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  fastify.decorate('clerk', clerk)

  fastify.decorate('authenticate', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) return reply.status(401).send({ error: 'Missing Authorization header' })

    const [scheme, token] = authHeader.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return reply.status(401).send({ error: 'Authorization must be: Bearer <token>' })
    }

    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      request.userId = payload.sub
      request.userRole = (payload as any).metadata?.role
    } catch (err: any) {
      console.error('[AUTH] Token verification failed:', err?.message || err, '| reason:', err?.reason, '| clerk_trace_id:', err?.clerk_trace_id)
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

declare module 'fastify' {
  interface FastifyInstance {
    clerk: ReturnType<typeof createClerkClient>
  }
}
