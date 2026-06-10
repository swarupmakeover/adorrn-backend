import { FastifyInstance } from 'fastify'
import { PaymentService } from '../services/payment.service.js'

export default async function paymentRoutes(app: FastifyInstance) {
  const paymentService = new PaymentService(app.db)

  app.post('/create-order', {
    schema: {
      description: 'Create Razorpay order (customer)',
      tags: ['Payments'],
      body: {
        type: 'object',
        required: ['order_id'],
        properties: {
          order_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { order_id } = request.body as any

    const { rows: [order] } = await app.db.query(
      'SELECT * FROM orders WHERE id = $1', [order_id]
    )
    if (!order) return reply.status(404).send({ error: 'Order not found' })

    const Razorpay = (await import('razorpay')).default
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(order.total) * 100),
      currency: 'INR',
      receipt: order.order_number,
    })

    await app.db.query(
      'UPDATE payments SET razorpay_order_id = $1 WHERE order_id = $2',
      [razorpayOrder.id, order_id]
    )

    return {
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    }
  })

  app.post('/verify', {
    schema: {
      description: 'Verify Razorpay payment signature',
      tags: ['Payments'],
      body: {
        type: 'object',
        required: ['order_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
        properties: {
          order_id: { type: 'string' },
          razorpay_order_id: { type: 'string' },
          razorpay_payment_id: { type: 'string' },
          razorpay_signature: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body as any

    try {
      const payment = await paymentService.verifyPayment(
        order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature
      )
      return { success: true, payment }
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
