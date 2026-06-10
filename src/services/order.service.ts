export class OrderService {
  constructor(private db: any) {}

  async create(data: {
    user_id: string; items: { variant_id: string; size_id?: string; quantity: number; price: number; product_name: string; variant_title?: string; size_label?: string; image_url?: string }[];
    subtotal: number; discount_amount: number; shipping_amount: number; tax_amount: number;
    total: number; discount_id?: string; shipping_address: Record<string, unknown>; billing_address?: Record<string, unknown>; notes?: string
  }) {
    const date = new Date()
    const orderNumber = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`

    const { rows: [order] } = await this.db.query(`
      INSERT INTO orders (order_number, user_id, status, subtotal, discount_amount, shipping_amount, tax_amount, total, discount_id, shipping_address, billing_address, notes)
      VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [orderNumber, data.user_id, data.subtotal, data.discount_amount, data.shipping_amount, data.tax_amount, data.total, data.discount_id || null, JSON.stringify(data.shipping_address), data.billing_address ? JSON.stringify(data.billing_address) : null, data.notes || null])

    for (const item of data.items) {
      await this.db.query(`
        INSERT INTO order_items (order_id, variant_id, size_id, product_name, variant_title, size_label, quantity, unit_price, total_price, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [order.id, item.variant_id, item.size_id || null, item.product_name, item.variant_title || null, item.size_label || null, item.quantity, item.price, item.price * item.quantity, item.image_url || null])
    }

    await this.db.query(`
      INSERT INTO order_status_history (order_id, status, created_by) VALUES ($1, 'pending', $2)
    `, [order.id, data.user_id])

    return order
  }

  async getById(id: string, userId?: string) {
    const query = userId
      ? 'SELECT * FROM orders WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM orders WHERE id = $1'
    const params = userId ? [id, userId] : [id]
    const { rows: [order] } = await this.db.query(query, params)
    if (!order) return null

    const { rows: items } = await this.db.query('SELECT * FROM order_items WHERE order_id = $1', [id])
    const { rows: history } = await this.db.query('SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC', [id])
    const { rows: [payment] } = await this.db.query('SELECT * FROM payments WHERE order_id = $1', [id])

    return { ...order, items, history, payment }
  }

  async listByUser(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit
    const { rows: [{ count }] } = await this.db.query('SELECT COUNT(*) FROM orders WHERE user_id = $1', [userId])
    const { rows } = await this.db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset])
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  }

  async listAll(filters: { status?: string; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`o.status = $${paramIndex++}`)
      params.push(status)
    }
    if (search) {
      conditions.push(`(o.order_number ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const join = search ? ' LEFT JOIN users u ON u.id = o.user_id' : ''
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows: [{ count }] } = await this.db.query(`SELECT COUNT(*) FROM orders o${join} ${where}`, params)
    const { rows } = await this.db.query(`SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o${join} ${where} ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...params, limit, offset])
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  }

  async updateStatus(id: string, status: string, note?: string, adminId?: string) {
    await this.db.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [status, id])
    await this.db.query('INSERT INTO order_status_history (order_id, status, note, created_by) VALUES ($1, $2, $3, $4)', [id, status, note || null, adminId || null])
    return this.getById(id)
  }
}
