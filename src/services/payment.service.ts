import crypto from 'crypto'

export class PaymentService {
  constructor(private db: any) {}

  verifyRazorpaySignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
    const body = razorpayOrderId + '|' + razorpayPaymentId
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')
    return expected === signature
  }

  async createOrder(orderId: string, amount: number) {
    const { rows: [payment] } = await this.db.query(`
      INSERT INTO payments (order_id, amount, status) VALUES ($1, $2, 'created') RETURNING *
    `, [orderId, amount])
    return payment
  }

  async verifyPayment(orderId: string, razorpayOrderId: string, razorpayPaymentId: string, signature: string) {
    const valid = this.verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, signature)
    if (!valid) throw new Error('Invalid payment signature')

    const { rows: [payment] } = await this.db.query(`
      UPDATE payments SET razorpay_order_id = $2, razorpay_payment_id = $3, razorpay_signature = $4, status = 'captured', updated_at = now()
      WHERE order_id = $1 RETURNING *
    `, [orderId, razorpayOrderId, razorpayPaymentId, signature])

    await this.db.query("UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1", [orderId])

    return payment
  }

  async getByOrderId(orderId: string) {
    const { rows: [payment] } = await this.db.query('SELECT * FROM payments WHERE order_id = $1', [orderId])
    return payment || null
  }
}
