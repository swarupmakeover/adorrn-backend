import { FastifyInstance } from 'fastify'
import { OrderService } from '../../services/order.service.js'

export default async function adminDashboardRoutes(app: FastifyInstance) {
  const orderService = new OrderService(app.db)

  app.get('/orders', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'List all orders with filters (admin)',
      tags: ['Admin - Orders'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { status, page, limit } = request.query as any
    const result = await orderService.listAll({ status, page, limit })
    return result
  })

  app.get('/orders/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get order detail with items, payment, history (admin)',
      tags: ['Admin - Orders'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const order = await orderService.getById(id)
    if (!order) return reply.status(404).send({ error: 'Order not found' })
    return order
  })

  app.patch('/orders/:id/status', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update order status (admin)',
      tags: ['Admin - Orders'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
          note: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { status, note } = request.body as any
    let adminUuid: string | undefined
    const clerkId = request.userId
    if (clerkId) {
      const { rows: [u] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])
      adminUuid = u?.id
    }
    const order = await orderService.updateStatus(id, status, note, adminUuid)
    return order
  })

  app.post('/orders/:id/refund', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Issue a refund via Razorpay (admin)',
      tags: ['Admin - Orders'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { amount } = request.body as any

    const { rows: [payment] } = await app.db.query(
      "SELECT * FROM payments WHERE order_id = $1 AND status = 'captured'", [id]
    )
    if (!payment) return reply.status(400).send({ error: 'No captured payment found' })

    const Razorpay = (await import('razorpay')).default
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const refundAmount = amount || payment.amount
    await razorpay.payments.refund(payment.razorpay_payment_id, { amount: Math.round(refundAmount * 100) })

    await app.db.query(
      "UPDATE payments SET status = 'refunded', updated_at = now() WHERE id = $1", [payment.id]
    )
    await app.db.query(
      "UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = $1", [id]
    )

    reply.status(200).send({ success: true, refunded_amount: refundAmount })
  })
}
