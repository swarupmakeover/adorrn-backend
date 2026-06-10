import { FastifyInstance } from 'fastify'

export default async function userRoutes(app: FastifyInstance) {
  async function resolveUser(request: any, reply: any) {
    const userId = request.userId
    if (!userId) { reply.status(401).send({ error: 'Unauthorized' }); return }
    let { rows: [user] } = await app.db.query('SELECT * FROM users WHERE clerk_id = $1', [userId])
    if (!user) {
      const clerkUser = await app.clerk.users.getUser(userId)
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || ''
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null
      const result = await app.db.query(`
        INSERT INTO users (clerk_id, email, name, avatar_url, role)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
      `, [userId, email, name, clerkUser.imageUrl || null, 'customer'])
      user = result.rows[0]
    }
    return user
  }

  app.get('/me', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Get own profile',
      tags: ['Users'],
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return
    return user
  })

  app.patch('/me', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Update own profile',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          avatar_url: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return

    const data = request.body as any
    const fields: string[] = []
    const params: any[] = [user.clerk_id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      const { rows } = await app.db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE clerk_id = $1 RETURNING *`, params
      )
      return rows[0]
    }
    return user
  })

  app.get('/me/addresses', {
    preHandler: [app.authenticate],
    schema: {
      description: 'List own addresses',
      tags: ['Users - Addresses'],
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return

    const { rows } = await app.db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
      [user.id]
    )
    return rows
  })

  app.post('/me/addresses', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Add a new address',
      tags: ['Users - Addresses'],
      body: {
        type: 'object',
        required: ['line1', 'city', 'state', 'pincode'],
        properties: {
          label: { type: 'string' },
          line1: { type: 'string' },
          line2: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          pincode: { type: 'string' },
          country: { type: 'string', default: 'IN' },
          is_default: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return

    const data = request.body as any
    if (data.is_default) {
      await app.db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [user.id])
    }

    const { rows: [address] } = await app.db.query(`
      INSERT INTO addresses (user_id, label, line1, line2, city, state, pincode, country, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [user.id, data.label || null, data.line1, data.line2 || null, data.city, data.state,
      data.pincode, data.country || 'IN', data.is_default || false])

    reply.status(201).send(address)
  })

  app.patch('/me/addresses/:id', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Update an address',
      tags: ['Users - Addresses'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return

    const { id } = request.params as any
    const data = request.body as any

    if (data.is_default) {
      await app.db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [user.id])
    }

    const fields: string[] = []
    const params: any[] = [id, user.id]
    let paramIndex = 3

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      const { rows } = await app.db.query(
        `UPDATE addresses SET ${fields.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`, params
      )
      return rows[0] || reply.status(404).send({ error: 'Address not found' })
    }
  })

  app.delete('/me/addresses/:id', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Delete an address',
      tags: ['Users - Addresses'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const user = await resolveUser(request, reply)
    if (!user) return

    const { id } = request.params as any
    await app.db.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [id, user.id])
    reply.status(204).send()
  })

  app.post('/sync', {
    schema: {
      description: 'Internal webhook endpoint to sync user from Clerk',
      tags: ['Users'],
      hide: true,
    },
  }, async (request, reply) => {
    const secret = request.headers['x-webhook-secret']
    if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const data = request.body as any
    await app.db.query(`
      INSERT INTO users (clerk_id, email, name, avatar_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (clerk_id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now()
    `, [data.id, data.email_addresses?.[0]?.email_address || data.email, `${data.first_name || ''} ${data.last_name || ''}`.trim() || null, data.image_url || null])

    reply.status(200).send({ success: true })
  })

  app.get('/admin/customers', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'List all customers (admin)',
      tags: ['Users - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { page = 1, limit = 20, search } = request.query as any
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows: [{ count }] } = await app.db.query(`SELECT COUNT(*) FROM users ${where}`, params)

    params.push(limit, offset)
    const { rows } = await app.db.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id AND status NOT IN ('cancelled', 'refunded')) as total_spent
      FROM users u ${where}
      ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params)

    return { data: rows, total: parseInt(count), page, limit }
  })
}
