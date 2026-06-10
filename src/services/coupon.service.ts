export class CouponService {
  constructor(private db: any) {}

  async validate(data: {
    code: string; userId?: string; cartItems: { variantId: string; productId: string; quantity: number; price: number }[];
    subtotal: number; isFirstOrder?: boolean
  }) {
    const { rows: [coupon] } = await this.db.query('SELECT * FROM coupons WHERE LOWER(code) = LOWER($1)', [data.code])
    if (!coupon) return { valid: false, errorCode: 'NOT_FOUND' }

    if (!coupon.is_active) return { valid: false, errorCode: 'INACTIVE' }

    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) return { valid: false, errorCode: 'NOT_STARTED' }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { valid: false, errorCode: 'EXPIRED' }

    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { valid: false, errorCode: 'USAGE_LIMIT' }

    if (data.userId) {
      const { rows: [{ count }] } = await this.db.query(
        'SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2',
        [coupon.id, data.userId]
      )
      if (parseInt(count) >= coupon.max_uses_per_user) return { valid: false, errorCode: 'USER_USAGE_LIMIT' }

      if (coupon.first_order_only) {
        const { rows: [{ orderCount }] } = await this.db.query(
          'SELECT COUNT(*) as "orderCount" FROM orders WHERE user_id = $1',
          [data.userId]
        )
        if (parseInt(orderCount) > 0) return { valid: false, errorCode: 'FIRST_ORDER_ONLY' }
      }
    }

    let eligibleSubtotal = data.subtotal
    if (coupon.applies_to === 'product' && coupon.product_ids?.length) {
      eligibleSubtotal = data.cartItems
        .filter(i => coupon.product_ids.includes(i.productId))
        .reduce((sum, i) => sum + i.price * i.quantity, 0)
    }
    if (coupon.applies_to === 'collection' && coupon.collection_ids?.length) {
      const productIds = data.cartItems.map(i => i.productId)
      const { rows } = await this.db.query(
        'SELECT product_id FROM product_collections WHERE collection_id = ANY($1::uuid[]) AND product_id = ANY($2::uuid[])',
        [coupon.collection_ids, productIds]
      )
      const eligibleProductIds = new Set(rows.map((r: any) => r.product_id))
      eligibleSubtotal = data.cartItems
        .filter(i => eligibleProductIds.has(i.productId))
        .reduce((sum, i) => sum + i.price * i.quantity, 0)
    }

    if (eligibleSubtotal < Number(coupon.min_order_value)) return { valid: false, errorCode: 'MIN_ORDER' }
    if (eligibleSubtotal <= 0) return { valid: false, errorCode: 'NO_ELIGIBLE_ITEMS' }

    let discountAmount = 0
    let freeShipping = false
    let freeItems: { productId: string; quantity: number }[] = []

    switch (coupon.type) {
      case 'percentage':
        discountAmount = (eligibleSubtotal * Number(coupon.value)) / 100
        if (coupon.max_discount_amount) discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount))
        break
      case 'fixed_amount':
        discountAmount = Math.min(Number(coupon.value), eligibleSubtotal)
        break
      case 'free_shipping':
        freeShipping = true
        break
      case 'buy_x_get_y':
        if (coupon.buy_quantity && coupon.get_quantity) {
          const totalQty = data.cartItems.reduce((sum, i) => sum + i.quantity, 0)
          if (totalQty >= coupon.buy_quantity) {
            const freeQty = Math.floor(totalQty / coupon.buy_quantity) * coupon.get_quantity
            if (coupon.get_product_ids?.length) {
              freeItems = coupon.get_product_ids.map((pid: string) => ({ productId: pid, quantity: freeQty }))
            }
          }
        }
        break
    }

    return { valid: true, discountAmount, freeShipping, freeItems, coupon }
  }

  async listAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit
    const { rows: [{ count }] } = await this.db.query('SELECT COUNT(*) FROM coupons')
    const { rows } = await this.db.query('SELECT * FROM coupons ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
    return { data: rows, total: parseInt(count), page, limit }
  }

  async getById(id: string) {
    const { rows: [coupon] } = await this.db.query('SELECT * FROM coupons WHERE id = $1', [id])
    if (!coupon) return null

    const { rows: usages } = await this.db.query(`
      SELECT cu.*, u.name as user_name, u.email as user_email
      FROM coupon_usages cu LEFT JOIN users u ON u.id = cu.user_id
      WHERE cu.coupon_id = $1 ORDER BY cu.used_at DESC
    `, [id])

    return { ...coupon, usages }
  }

  async create(data: {
    code: string; description?: string; type: string; value?: number;
    applies_to?: string; product_ids?: string[]; collection_ids?: string[];
    excluded_product_ids?: string[]; buy_quantity?: number; get_quantity?: number;
    get_product_ids?: string[]; min_order_value?: number; min_item_quantity?: number;
    max_discount_amount?: number; first_order_only?: boolean; new_customers_only?: boolean;
    max_uses?: number; max_uses_per_user?: number; starts_at?: string; expires_at?: string;
    created_by?: string
  }) {
    const { rows: [coupon] } = await this.db.query(`
      INSERT INTO coupons (code, description, type, value, applies_to, product_ids, collection_ids,
        excluded_product_ids, buy_quantity, get_quantity, get_product_ids, min_order_value,
        min_item_quantity, max_discount_amount, first_order_only, new_customers_only,
        max_uses, max_uses_per_user, starts_at, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [data.code.toUpperCase(), data.description || null, data.type, data.value || null,
      data.applies_to || 'order', data.product_ids || null, data.collection_ids || null,
      data.excluded_product_ids || null, data.buy_quantity || null, data.get_quantity || null,
      data.get_product_ids || null, data.min_order_value || 0, data.min_item_quantity || 0,
      data.max_discount_amount || null, data.first_order_only || false,
      data.new_customers_only || false, data.max_uses || null, data.max_uses_per_user || 1,
      data.starts_at || null, data.expires_at || null, data.created_by || null])
    return coupon
  }

  async update(id: string, data: Record<string, any>) {
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(key === 'code' ? String(value).toUpperCase() : value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      await this.db.query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = $1`, params)
    }

    return this.getById(id)
  }

  async softDelete(id: string) {
    await this.db.query('UPDATE coupons SET is_active = false, updated_at = now() WHERE id = $1', [id])
  }

  async recordUsage(couponId: string, userId: string, orderId: string) {
    await this.db.query(
      'INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES ($1, $2, $3)',
      [couponId, userId, orderId]
    )
    await this.db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [couponId])
  }
}
