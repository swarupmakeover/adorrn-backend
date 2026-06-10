import { FastifyInstance } from 'fastify'
import crypto from 'crypto'

export default async function razorpayWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook', {
    schema: {
      description: 'Razorpay webhook receiver (HMAC-verified)',
      tags: ['Webhooks'],
      hide: true,
    },
  }, async (request, reply) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!
    const body = JSON.stringify(request.body)
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex')

    const receivedSignature = request.headers['x-razorpay-signature'] as string
    if (expectedSignature !== receivedSignature) {
      return reply.status(401).send({ error: 'Invalid signature' })
    }

    const event = request.body as any
    const payment = event.payload?.payment?.entity

    if (event.event === 'payment.captured' && payment) {
      await app.db.query(`
        UPDATE payments SET razorpay_payment_id = $2, status = 'captured', method = $3, updated_at = now()
        WHERE razorpay_order_id = $1
      `, [payment.order_id, payment.id, payment.method])

      const { rows: [pay] } = await app.db.query(
        'SELECT order_id FROM payments WHERE razorpay_order_id = $1', [payment.order_id]
      )
      if (pay) {
        await app.db.query(
          "UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1", [pay.order_id]
        )
      }
    }

    if (event.event === 'payment.failed' && payment) {
      await app.db.query(`
        UPDATE payments SET status = 'failed', failure_reason = $2, updated_at = now()
        WHERE razorpay_order_id = $1
      `, [payment.order_id, payment.error_description || null])

      const { rows: [pay] } = await app.db.query(
        'SELECT order_id FROM payments WHERE razorpay_order_id = $1', [payment.order_id]
      )
      if (pay) {
        await app.db.query(
          "UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1", [pay.order_id]
        )
      }
    }

    reply.status(200).send({ status: 'ok' })
  })
}
