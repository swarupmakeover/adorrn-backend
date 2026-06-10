import { FastifyInstance } from 'fastify'

export default async function collectionRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      description: 'List all active collections',
      tags: ['Collections'],
    },
  }, async () => {
    const { rows } = await app.db.query(
      'SELECT * FROM collections WHERE is_active = true ORDER BY sort_order ASC'
    )
    return rows
  })

  app.get('/:slug', {
    schema: {
      description: 'Get collection with paginated products',
      tags: ['Collections'],
      params: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as any
    const { page = 1, limit = 20 } = request.query as any
    const offset = (page - 1) * limit

    const { rows: [collection] } = await app.db.query(
      'SELECT * FROM collections WHERE slug = $1', [slug]
    )
    if (!collection) return reply.status(404).send({ error: 'Collection not found' })

    const { rows: [{ count }] } = await app.db.query(`
      SELECT COUNT(*) FROM product_collections pc
      JOIN products p ON p.id = pc.product_id
      WHERE pc.collection_id = $1 AND p.is_active = true
    `, [collection.id])

    const { rows: products } = await app.db.query(`
      SELECT p.*,
        (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'is_primary', pi.is_primary) ORDER BY pi.position) FROM product_images pi WHERE pi.product_id = p.id) as images
      FROM products p
      JOIN product_collections pc ON pc.product_id = p.id
      WHERE pc.collection_id = $1 AND p.is_active = true
      ORDER BY p.created_at DESC LIMIT $2 OFFSET $3
    `, [collection.id, limit, offset])

    return { ...collection, products, total: parseInt(count), page, limit }
  })

  app.post('/', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a collection (admin only)',
      tags: ['Collections'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          image_url: { type: 'string' },
          sort_order: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const data = request.body as any
    const { rows: [collection] } = await app.db.query(`
      INSERT INTO collections (name, slug, description, image_url, sort_order)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [data.name, data.slug, data.description || null, data.image_url || null, data.sort_order ?? 0])
    reply.status(201).send(collection)
  })

  app.patch('/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a collection (admin only)',
      tags: ['Collections'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const data = request.body as any
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      const { rows } = await app.db.query(`UPDATE collections SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      return rows[0]
    }
  })
}
