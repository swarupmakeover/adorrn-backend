import { FastifyInstance } from 'fastify'
import { OrderService } from '../services/order.service.js'
import { CouponService } from '../services/coupon.service.js'
import { InventoryService } from '../services/inventory.service.js'

export default async function orderRoutes(app: FastifyInstance) {
  const orderService = new OrderService(app.db)
  const couponService = new CouponService(app.db)
  const inventoryService = new InventoryService(app.db)

  async function resolveUserId(request: any, reply: any): Promise<string | undefined> {
    const clerkId = request.userId
    if (!clerkId) { reply.status(401).send({ error: 'Unauthorized' }); return }
    let { rows: [user] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])
    if (!user) {
      const clerkUser = await app.clerk.users.getUser(clerkId)
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || ''
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null
      const result = await app.db.query(`
        INSERT INTO users (clerk_id, email, name, avatar_url, role)
        VALUES ($1, $2, $3, $4, 'customer') RETURNING id
      `, [clerkId, email, name, clerkUser.imageUrl || null])
      user = result.rows[0]
    }
    return user.id
  }

  app.post('/', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Create order from cart (customer only)',
      tags: ['Orders'],
      body: {
        type: 'object',
        required: ['items', 'subtotal', 'total', 'shipping_address'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['variant_id', 'quantity', 'price', 'product_name'],
              properties: {
                variant_id: { type: 'string' },
                size_id: { type: 'string' },
                quantity: { type: 'integer' },
                price: { type: 'number' },
                product_name: { type: 'string' },
                variant_title: { type: 'string' },
                size_label: { type: 'string' },
                image_url: { type: 'string' },
              },
            },
          },
          subtotal: { type: 'number' },
          discount_amount: { type: 'number' },
          shipping_amount: { type: 'number' },
          tax_amount: { type: 'number' },
          total: { type: 'number' },
          coupon_code: { type: 'string' },
          shipping_address: { type: 'object' },
          billing_address: { type: 'object' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const localUserId = await resolveUserId(request, reply)
    if (!localUserId) return

    const data = request.body as any

    let discountId: string | undefined
    if (data.coupon_code) {
      const validation = await couponService.validate({
        code: data.coupon_code,
        userId: localUserId,
        cartItems: data.items.map((i: any) => ({
          variantId: i.variant_id,
          productId: i.product_id || i.variant_id,
          quantity: i.quantity,
          price: i.price,
        })),
        subtotal: data.subtotal,
      })
      if (validation.valid && validation.coupon) {
        discountId = validation.coupon.id
      }
    }

    const order = await orderService.create({
      user_id: localUserId,
      items: data.items,
      subtotal: data.subtotal,
      discount_amount: data.discount_amount || 0,
      shipping_amount: data.shipping_amount || 0,
      tax_amount: data.tax_amount || 0,
      total: data.total,
      discount_id: discountId,
      shipping_address: data.shipping_address,
      billing_address: data.billing_address,
      notes: data.notes,
    })

    reply.status(201).send(order)
  })

  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      description: 'List own orders (customer)',
      tags: ['Orders'],
    },
  }, async (request, reply) => {
    const localUserId = await resolveUserId(request, reply)
    if (!localUserId) return

    const { page = 1, limit = 20 } = request.query as any
    const result = await orderService.listByUser(localUserId, page, limit)
    return result
  })

  app.get('/:id', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Get order detail (customer - own orders)',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const localUserId = await resolveUserId(request, reply)
    if (!localUserId) return

    const { id } = request.params as any
    const order = await orderService.getById(id, localUserId)
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    return order
  })
}
