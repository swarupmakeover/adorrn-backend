export class HomepageService {
  constructor(private db: any) {}

  async getFullHomepage() {
    const { rows: heroSlides } = await this.db.query(`
      SELECT * FROM hero_slides
      WHERE is_active = true
        AND (starts_at IS NULL OR starts_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY position ASC
    `)

    const { rows: featured } = await this.db.query(`
      SELECT hfp.*, p.id, p.name, p.slug, p.price, p.compare_at_price,
        pi.url as primary_image_url
      FROM homepage_featured_products hfp
      JOIN products p ON p.id = hfp.product_id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
      WHERE hfp.is_active = true AND p.is_active = true
      ORDER BY hfp.position ASC
    `)

    const { rows: testimonials } = await this.db.query(`
      SELECT * FROM testimonials
      WHERE is_active = true
      ORDER BY position ASC
    `)

    const { rows: sections } = await this.db.query(`
      SELECT * FROM homepage_sections ORDER BY sort_order ASC
    `)

    return { heroSlides, featured, testimonials, sections }
  }

  async getSections() {
    const { rows } = await this.db.query('SELECT * FROM homepage_sections ORDER BY sort_order ASC')
    return rows
  }

  async updateSection(key: string, data: { is_visible?: boolean; title?: string; subtitle?: string; sort_order?: number; config?: Record<string, unknown> }) {
    const fields: string[] = []
    const params: any[] = [key]
    let paramIndex = 2

    for (const [k, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${k} = $${paramIndex++}`)
        params.push(k === 'config' ? JSON.stringify(value) : value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      const { rows } = await this.db.query(`UPDATE homepage_sections SET ${fields.join(', ')} WHERE key = $1 RETURNING *`, params)
      return rows[0]
    }
  }

  async getHeroSlides() {
    const { rows } = await this.db.query('SELECT * FROM hero_slides ORDER BY position ASC')
    return rows
  }

  async createHeroSlide(data: {
    title?: string; subtitle?: string; cta_label?: string; cta_url?: string;
    desktop_image_cloudinary_id: string; desktop_image_url: string;
    mobile_image_cloudinary_id?: string; mobile_image_url?: string;
    text_color?: string; overlay_opacity?: number; position?: number
  }) {
    const { rows: [slide] } = await this.db.query(`
      INSERT INTO hero_slides (title, subtitle, cta_label, cta_url,
        desktop_image_cloudinary_id, desktop_image_url,
        mobile_image_cloudinary_id, mobile_image_url,
        text_color, overlay_opacity, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [data.title || null, data.subtitle || null, data.cta_label || null, data.cta_url || null,
      data.desktop_image_cloudinary_id, data.desktop_image_url,
      data.mobile_image_cloudinary_id || null, data.mobile_image_url || null,
      data.text_color || '#ffffff', data.overlay_opacity ?? 0.3, data.position ?? 0])
    return slide
  }

  async updateHeroSlide(id: string, data: Record<string, any>) {
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      const { rows } = await this.db.query(`UPDATE hero_slides SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      return rows[0]
    }
  }

  async deleteHeroSlide(id: string) {
    await this.db.query('DELETE FROM hero_slides WHERE id = $1', [id])
  }

  async reorderHeroSlides(items: { id: string; position: number }[]) {
    for (const item of items) {
      await this.db.query('UPDATE hero_slides SET position = $1 WHERE id = $2', [item.position, item.id])
    }
  }

  async getFeaturedProducts() {
    const { rows } = await this.db.query(`
      SELECT hfp.*, p.name, p.slug, p.price, p.compare_at_price,
        pi.url as primary_image_url
      FROM homepage_featured_products hfp
      JOIN products p ON p.id = hfp.product_id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
      ORDER BY hfp.position ASC
    `)
    return rows
  }

  async setFeaturedProducts(items: { product_id: string; position: number; label?: string }[]) {
    await this.db.query('DELETE FROM homepage_featured_products')
    for (const item of items) {
      await this.db.query(
        'INSERT INTO homepage_featured_products (product_id, position, label) VALUES ($1, $2, $3)',
        [item.product_id, item.position, item.label || null]
      )
    }
  }

  async getTestimonials() {
    const { rows } = await this.db.query('SELECT * FROM testimonials ORDER BY position ASC')
    return rows
  }

  async createTestimonial(data: {
    author_name: string; author_title?: string; avatar_cloudinary_id?: string;
    avatar_url?: string; body: string; rating?: number; source?: string;
    source_url?: string; position?: number
  }) {
    const { rows: [testimonial] } = await this.db.query(`
      INSERT INTO testimonials (author_name, author_title, avatar_cloudinary_id, avatar_url,
        body, rating, source, source_url, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [data.author_name, data.author_title || null, data.avatar_cloudinary_id || null,
      data.avatar_url || null, data.body, data.rating || null, data.source || null,
      data.source_url || null, data.position ?? 0])
    return testimonial
  }

  async updateTestimonial(id: string, data: Record<string, any>) {
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      const { rows } = await this.db.query(`UPDATE testimonials SET ${fields.join(', ')} WHERE id = $1 RETURNING *`, params)
      return rows[0]
    }
  }

  async deleteTestimonial(id: string) {
    await this.db.query('DELETE FROM testimonials WHERE id = $1', [id])
  }

  async reorderTestimonials(items: { id: string; position: number }[]) {
    for (const item of items) {
      await this.db.query('UPDATE testimonials SET position = $1 WHERE id = $2', [item.position, item.id])
    }
  }
}
