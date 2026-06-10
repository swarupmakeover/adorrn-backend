import { FastifyInstance } from 'fastify'

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
    const secretKey = process.env.CLERK_SECRET_KEY!

    let userId = directUserId

    if (!userId && email) {
      const res = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(email), {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      if (!res.ok) return reply.status(400).send({ error: 'User not found with that email' })
      const users = await res.json() as any[]
      if (!users.length) return reply.status(400).send({ error: 'No Clerk user found with that email' })
      userId = users[0].id
    }

    const sessionRes = await fetch('https://api.clerk.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    })

    if (!sessionRes.ok) {
      const err = await sessionRes.text()
      return reply.status(400).send({ error: `Session creation failed: ${err}` })
    }

    const session = await sessionRes.json() as any

    const tokenRes = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return reply.status(400).send({ error: `Token generation failed: ${err}` })
    }

    const token = await tokenRes.json() as any

    return {
      token: token.jwt,
      userId,
      sessionId: session.id,
    }
  })
}
