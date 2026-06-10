import { FastifyInstance } from 'fastify'

export default async function sizeRoutes(app: FastifyInstance) {
  app.get('/groups', {
    schema: {
      description: 'Get all size groups with their sizes',
      tags: ['Sizes'],
    },
  }, async () => {
    const { rows: groups } = await app.db.query('SELECT * FROM size_groups ORDER BY name ASC')
    for (const group of groups) {
      const { rows: sizes } = await app.db.query(
        'SELECT * FROM sizes WHERE size_group_id = $1 ORDER BY sort_order ASC',
        [group.id]
      )
      group.sizes = sizes
    }
    return groups
  })

  app.post('/admin/groups', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a size group (admin)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { name } = request.body as any
    const { rows: [group] } = await app.db.query(
      'INSERT INTO size_groups (name) VALUES ($1) RETURNING *', [name]
    )
    reply.status(201).send(group)
  })

  app.patch('/admin/groups/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Rename a size group (admin)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { name } = request.body as any
    const { rows: [group] } = await app.db.query(
      'UPDATE size_groups SET name = $1 WHERE id = $2 RETURNING *', [name, id]
    )
    return group
  })

  app.delete('/admin/groups/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete a size group (cascades to sizes)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await app.db.query('DELETE FROM size_groups WHERE id = $1', [id])
    reply.status(204).send()
  })

  app.post('/admin/groups/:groupId/sizes', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Add a size to a group (admin)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { groupId: { type: 'string' } },
        required: ['groupId'],
      },
      body: {
        type: 'object',
        required: ['label'],
        properties: {
          label: { type: 'string' },
          sort_order: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const { groupId } = request.params as any
    const { label, sort_order } = request.body as any
    const { rows: [size] } = await app.db.query(
      'INSERT INTO sizes (size_group_id, label, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [groupId, label, sort_order ?? 0]
    )
    reply.status(201).send(size)
  })

  app.patch('/admin/sizes/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a size label/order (admin)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { label, sort_order } = request.body as any
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    if (label !== undefined) { fields.push(`label = $${paramIndex++}`); params.push(label) }
    if (sort_order !== undefined) { fields.push(`sort_order = $${paramIndex++}`); params.push(sort_order) }

    if (fields.length) {
      const { rows } = await app.db.query(`UPDATE sizes SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      return rows[0]
    }
  })

  app.delete('/admin/sizes/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete a size (admin)',
      tags: ['Sizes - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await app.db.query('DELETE FROM sizes WHERE id = $1', [id])
    reply.status(204).send()
  })
}
