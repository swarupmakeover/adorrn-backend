import { FastifyInstance } from 'fastify'
import { ProductService } from '../services/product.service.js'
import { InventoryService } from '../services/inventory.service.js'

export default async function productRoutes(app: FastifyInstance) {
  const productService = new ProductService(app.db)
  const inventoryService = new InventoryService(app.db)

  app.get('/', {
    schema: {
      description: 'List products with pagination, filters, and sort',
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          collection: { type: 'string' },
          search: { type: 'string' },
          featured: { type: 'boolean' },
          is_active: { type: 'boolean' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          sort: { type: 'string', enum: ['price_asc', 'price_desc', 'newest'] },
        },
      },
    },
  }, async (request, reply) => {
    const result = await productService.list(request.query as any)
    return result
  })

  app.get('/search', {
    schema: {
      description: 'Full-text search products',
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
        required: ['q'],
      },
    },
  }, async (request, reply) => {
    const { q, page, limit } = request.query as any
    const result = await productService.list({ search: q, page, limit })
    return result
  })

  app.get('/:slug', {
    schema: {
      description: 'Get single product by slug with variants, images, collections',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as any
    const product = await productService.getBySlug(slug)
    if (!product) return reply.status(404).send({ error: 'Product not found' })
    return product
  })

  app.get('/:slug/recommendations', {
    schema: {
      description: 'Get product recommendations from same collections',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as any
    const recommendations = await productService.getRecommendations(slug)
    return recommendations
  })

  app.post('/', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a new product (admin only)',
      tags: ['Products'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'slug', 'price'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description_html: { type: 'string' },
          description_text: { type: 'string' },
          price: { type: 'number' },
          compare_at_price: { type: 'number' },
          cost_price: { type: 'number' },
          sku: { type: 'string' },
          barcode: { type: 'string' },
          weight_grams: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          meta_title: { type: 'string' },
          meta_description: { type: 'string' },
          vendor: { type: 'string' },
          collection_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const product = await productService.create(request.body as any)
    reply.status(201).send(product)
  })

  app.patch('/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a product (admin only)',
      tags: ['Products'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const product = await productService.update(id, request.body as any)
    return product
  })

  app.delete('/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Soft-delete a product (admin only)',
      tags: ['Products'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await productService.softDelete(id)
    reply.status(204).send()
  })

  app.get('/:id/images', {
    schema: {
      description: 'Get ordered images for a product',
      tags: ['Product Images'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { rows } = await app.db.query(
      'SELECT * FROM product_images WHERE product_id = $1 ORDER BY position ASC', [id]
    )
    return rows
  })

  app.post('/:id/images', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Upload product image (multipart, admin only)',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })
    const product = await productService.getById(id)
    if (!product) return reply.status(404).send({ error: 'Product not found' })

    const result = await new Promise((resolve, reject) => {
      const stream = app.cloudinary.uploader.upload_stream(
        { folder: 'products', resource_type: 'image' },
        (err, res) => err ? reject(err) : resolve(res)
      )
      data.file.pipe(stream)
    }) as any

    const { rows: [image] } = await app.db.query(`
      INSERT INTO product_images (product_id, cloudinary_id, url, position)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), -1) + 1 FROM product_images WHERE product_id = $1))
      RETURNING *
    `, [id, result.public_id, result.secure_url])

    reply.status(201).send(image)
  })

  app.patch('/:id/images/:imgId', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update image metadata (alt text, primary, etc.)',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' }, imgId: { type: 'string' } },
        required: ['id', 'imgId'],
      },
    },
  }, async (request, reply) => {
    const { imgId } = request.params as any
    const data = request.body as any
    const fields: string[] = []
    const params: any[] = [imgId]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }
    if (fields.length) {
      const { rows } = await app.db.query(`UPDATE product_images SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      return rows[0]
    }
  })

  app.delete('/:id/images/:imgId', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete product image from DB and Cloudinary',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' }, imgId: { type: 'string' } },
        required: ['id', 'imgId'],
      },
    },
  }, async (request, reply) => {
    const { imgId } = request.params as any
    const { rows: [img] } = await app.db.query('SELECT * FROM product_images WHERE id = $1', [imgId])
    if (!img) return reply.status(404).send({ error: 'Image not found' })

    await app.cloudinary.uploader.destroy(img.cloudinary_id)
    await app.db.query('DELETE FROM product_images WHERE id = $1', [imgId])
    reply.status(204).send()
  })

  app.patch('/:id/images/reorder', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Batch reorder images',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const items = request.body as { id: string; position: number }[]
    for (const item of items) {
      await app.db.query('UPDATE product_images SET position = $1 WHERE id = $2 AND product_id = $3',
        [item.position, item.id, id])
    }
    reply.status(200).send({ success: true })
  })

  app.get('/:id/stock', {
    schema: {
      description: 'Get all variant+size stock for a product',
      tags: ['Product Stock'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const stock = await inventoryService.getProductStock(id)
    return stock
  })

  app.put('/:id/stock', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Upsert full stock matrix for a product (admin only)',
      tags: ['Product Stock'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const items = request.body as { variant_id: string; size_id: string; stock: number; sku?: string }[]
    const results = []
    for (const item of items) {
      const stock = await inventoryService.upsertStock({ product_id: id, ...item })
      results.push(stock)
    }
    return results
  })
}
