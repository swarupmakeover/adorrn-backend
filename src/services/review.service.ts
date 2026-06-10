export class ReviewService {
  constructor(private db: any) {}

  async getByProduct(productId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit
    const { rows: [{ count }] } = await this.db.query(
      'SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND status = $2',
      [productId, 'approved']
    )
    const { rows } = await this.db.query(`
      SELECT r.*, u.name as user_name, u.avatar_url as user_avatar,
        (SELECT jsonb_agg(jsonb_build_object('id', ri.id, 'url', ri.url)) FROM review_images ri WHERE ri.review_id = r.id) as images
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.product_id = $1 AND r.status = 'approved'
      ORDER BY r.created_at DESC LIMIT $2 OFFSET $3
    `, [productId, limit, offset])
    return { data: rows, total: parseInt(count), page, limit }
  }

  async getSummary(productId: string) {
    const { rows: [summary] } = await this.db.query(`
      SELECT
        COUNT(*) AS total_reviews,
        ROUND(AVG(rating), 1) AS average_rating,
        COUNT(*) FILTER (WHERE rating = 5) AS five_star,
        COUNT(*) FILTER (WHERE rating = 4) AS four_star,
        COUNT(*) FILTER (WHERE rating = 3) AS three_star,
        COUNT(*) FILTER (WHERE rating = 2) AS two_star,
        COUNT(*) FILTER (WHERE rating = 1) AS one_star
      FROM reviews
      WHERE product_id = $1 AND status = 'approved'
    `, [productId])
    return {
      ...summary,
      distribution: {
        1: parseInt(summary.one_star) || 0,
        2: parseInt(summary.two_star) || 0,
        3: parseInt(summary.three_star) || 0,
        4: parseInt(summary.four_star) || 0,
        5: parseInt(summary.five_star) || 0,
      },
    }
  }

  async create(data: {
    product_id: string; user_id: string; order_item_id?: string;
    rating: number; title?: string; body?: string; image_urls?: string[]
  }) {
    const { rows: [existing] } = await this.db.query(
      'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
      [data.product_id, data.user_id]
    )
    if (existing) throw new Error('Already reviewed this product')

    const isVerified = data.order_item_id ? true : false

    const { rows: [review] } = await this.db.query(`
      INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, is_verified_purchase)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [data.product_id, data.user_id, data.order_item_id || null, data.rating, data.title || null, data.body || null, isVerified])

    if (data.image_urls?.length) {
      for (const url of data.image_urls) {
        const cloudinaryId = url.split('/').pop()?.split('.')[0] || url
        await this.db.query(
          'INSERT INTO review_images (review_id, cloudinary_id, url) VALUES ($1, $2, $3)',
          [review.id, cloudinaryId, url]
        )
      }
    }

    return review
  }

  async markHelpful(reviewId: string, userId: string) {
    try {
      await this.db.query(
        'INSERT INTO review_helpful_votes (review_id, user_id) VALUES ($1, $2)',
        [reviewId, userId]
      )
      await this.db.query('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1', [reviewId])
    } catch {
      throw new Error('Already marked as helpful')
    }
  }

  async listAll(filters: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      conditions.push(`r.status = $${paramIndex++}`)
      params.push(status)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countQuery = `SELECT COUNT(*) FROM reviews r ${where}`
    const { rows: [{ count }] } = await this.db.query(countQuery, params)

    params.push(limit, offset)
    const dataQuery = `
      SELECT r.*, u.name as user_name, u.email as user_email,
        p.name as product_name, p.slug as product_slug
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN products p ON p.id = r.product_id
      ${where}
      ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `
    const { rows } = await this.db.query(dataQuery, params)
    return { data: rows, total: parseInt(count), page, limit }
  }

  async updateStatus(id: string, status: string) {
    const { rows: [review] } = await this.db.query(
      'UPDATE reviews SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, id]
    )
    return review
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM reviews WHERE id = $1', [id])
  }
}
