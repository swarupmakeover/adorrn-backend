import { FastifyInstance } from 'fastify'
import { verifyToken } from '@clerk/backend'

export default async function devRoutes(app: FastifyInstance) {
  app.post('/token', {
    schema: {
      description: 'DEV ONLY — Generate a Clerk JWT for testing. Provide userId or email.',
      tags: ['Dev'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          email: { type: 'string' },
        },
        oneOf: [
          { required: ['userId'] },
          { required: ['email'] },
        ],
      },
    },
  }, async (request, reply) => {
    const { userId: directUserId, email } = request.body as { userId?: string; email?: string }

    let userId: string | undefined = directUserId

    if (!userId && email) {
      const users = await app.clerk.users.getUserList({ emailAddress: [email] })
      if (!users.data.length) {
        return reply.status(400).send({ error: 'No Clerk user found with that email' })
      }
      userId = users.data[0].id
    }

    if (!userId) {
      return reply.status(400).send({ error: 'Unable to resolve userId' })
    }

    const session = await app.clerk.sessions.createSession({ userId }) as any
    const tokenResult = await app.clerk.sessions.getToken(session.id, 'default') as any
    const jwt = tokenResult.jwt || tokenResult

    return {
      token: jwt,
      userId,
      sessionId: session.id,
    }
  })

  app.post('/verify', {
    schema: {
      description: 'DEV ONLY — Verify a token and return its decoded payload.',
      tags: ['Dev'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { token } = request.body as { token: string }
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      return { valid: true, payload }
    } catch (err: any) {
      return { valid: false, error: err?.message || String(err), reason: err?.reason }
    }
  })
}
