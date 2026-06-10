export class CartService {
  constructor(private db: any) {}

  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (userId) {
      const { rows: [cart] } = await this.db.query('SELECT * FROM carts WHERE user_id = $1', [userId])
      if (cart) return this.getCartWithItems(cart.id)
      const { rows: [newCart] } = await this.db.query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING *', [userId]
      )
      return { ...newCart, items: [] }
    }

    if (sessionId) {
      const { rows: [cart] } = await this.db.query('SELECT * FROM carts WHERE session_id = $1', [sessionId])
      if (cart) return this.getCartWithItems(cart.id)
      const { rows: [newCart] } = await this.db.query(
        'INSERT INTO carts (session_id) VALUES ($1) RETURNING *', [sessionId]
      )
      return { ...newCart, items: [] }
    }

    throw new Error('userId or sessionId required')
  }

  async getCartWithItems(cartId: string) {
    const { rows: [cart] } = await this.db.query('SELECT * FROM carts WHERE id = $1', [cartId])
    if (!cart) return null

    const { rows: items } = await this.db.query(`
      SELECT ci.*, pv.title as variant_title, pv.price as price,
        p.name as product_name, p.slug as product_slug,
        pi.url as image_url
      FROM cart_items ci
      JOIN product_variants pv ON pv.id = ci.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN product_images pi ON pi.id = pv.image_id
      WHERE ci.cart_id = $1
    `, [cartId])

    return { ...cart, items }
  }

  async addItem(cartId: string, variantId: string, quantity: number) {
    const { rows: [existing] } = await this.db.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
      [cartId, variantId]
    )

    if (existing) {
      await this.db.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2',
        [quantity, existing.id]
      )
    } else {
      await this.db.query(
        'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)',
        [cartId, variantId, quantity]
      )
    }

    await this.db.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId])
    return this.getCartWithItems(cartId)
  }

  async updateItemQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      await this.db.query('DELETE FROM cart_items WHERE id = $1', [itemId])
    } else {
      await this.db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, itemId])
    }
  }

  async removeItem(itemId: string) {
    await this.db.query('DELETE FROM cart_items WHERE id = $1', [itemId])
  }

  async mergeGuestCart(sessionId: string, userId: string) {
    const { rows: [guestCart] } = await this.db.query(
      'SELECT * FROM carts WHERE session_id = $1', [sessionId]
    )
    if (!guestCart) return

    const { rows: [userCart] } = await this.db.query(
      'SELECT * FROM carts WHERE user_id = $1', [userId]
    )

    if (!userCart) {
      await this.db.query('UPDATE carts SET user_id = $1, session_id = NULL WHERE id = $2',
        [userId, guestCart.id])
      return
    }

    const { rows: guestItems } = await this.db.query(
      'SELECT * FROM cart_items WHERE cart_id = $1', [guestCart.id]
    )

    for (const item of guestItems) {
      const { rows: [existing] } = await this.db.query(
        'SELECT * FROM cart_items WHERE cart_id = $1 AND variant_id = $2',
        [userCart.id, item.variant_id]
      )
      if (existing) {
        await this.db.query('UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2',
          [item.quantity, existing.id])
      } else {
        await this.db.query(
          'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)',
          [userCart.id, item.variant_id, item.quantity]
        )
      }
    }

    await this.db.query('DELETE FROM carts WHERE id = $1', [guestCart.id])
    await this.db.query('UPDATE carts SET updated_at = now() WHERE id = $1', [userCart.id])
  }

  async clearCart(cartId: string) {
    await this.db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId])
    await this.db.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cartId])
  }
}
