import { FastifyInstance } from 'fastify'
import { CouponService } from '../services/coupon.service.js'

export default async function couponRoutes(app: FastifyInstance) {
  const couponService = new CouponService(app.db)

  app.post('/validate', {
    schema: {
      description: 'Validate a coupon code and calculate discount',
      tags: ['Coupons'],
      body: {
        type: 'object',
        required: ['code', 'cartItems', 'subtotal'],
        properties: {
          code: { type: 'string' },
          cartItems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['variantId', 'productId', 'quantity', 'price'],
              properties: {
                variantId: { type: 'string' },
                productId: { type: 'string' },
                quantity: { type: 'integer' },
                price: { type: 'number' },
              },
            },
          },
          subtotal: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const data = request.body as any
    let localUuid: string | undefined
    const clerkId = request.userId
    if (clerkId) {
      const { rows: [u] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])
      localUuid = u?.id
    }
    const result = await couponService.validate({
      ...data,
      userId: localUuid,
    })
    if (!result.valid) {
      return reply.status(400).send({ valid: false, errorCode: result.errorCode })
    }
    return result
  })

  app.get('/admin', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'List all coupons (admin)',
      tags: ['Coupons - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { page, limit } = request.query as any
    const result = await couponService.listAll(page, limit)
    return result
  })

  app.get('/admin/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get coupon with usage details (admin)',
      tags: ['Coupons - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const coupon = await couponService.getById(id)
    if (!coupon) return reply.status(404).send({ error: 'Coupon not found' })
    return coupon
  })

  app.post('/admin', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a coupon (admin)',
      tags: ['Coupons - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code', 'type'],
        properties: {
          code: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y'] },
          value: { type: 'number' },
          applies_to: { type: 'string', enum: ['order', 'product', 'collection'], default: 'order' },
          product_ids: { type: 'array', items: { type: 'string' } },
          collection_ids: { type: 'array', items: { type: 'string' } },
          excluded_product_ids: { type: 'array', items: { type: 'string' } },
          buy_quantity: { type: 'integer' },
          get_quantity: { type: 'integer' },
          get_product_ids: { type: 'array', items: { type: 'string' } },
          min_order_value: { type: 'number' },
          max_discount_amount: { type: 'number' },
          first_order_only: { type: 'boolean' },
          max_uses: { type: 'integer' },
          max_uses_per_user: { type: 'integer', default: 1 },
          starts_at: { type: 'string' },
          expires_at: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const data = request.body as any
    let createdBy: string | undefined
    const clerkId = request.userId
    if (clerkId) {
      const { rows: [u] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])
      createdBy = u?.id
    }
    const coupon = await couponService.create({ ...data, created_by: createdBy })
    reply.status(201).send(coupon)
  })

  app.patch('/admin/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a coupon (admin)',
      tags: ['Coupons - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const coupon = await couponService.update(id, request.body as any)
    return coupon
  })

  app.delete('/admin/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Soft-delete a coupon (admin)',
      tags: ['Coupons - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await couponService.softDelete(id)
    reply.status(204).send()
  })
}
