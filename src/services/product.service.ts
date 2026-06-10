export class ProductService {
  constructor(private db: any) {}

  async list(filters: { collection?: string; is_active?: boolean; featured?: boolean; search?: string; page?: number; limit?: number; sort?: string }) {
    const { collection, is_active, featured, search, page = 1, limit = 20, sort } = filters
    const offset = (page - 1) * limit
    const params: any[] = []
    const conditions: string[] = []
    let paramIndex = 1

    if (collection) {
      params.push(collection)
      conditions.push(`pc.collection_id = (SELECT id FROM collections WHERE slug = $${paramIndex++})`)
    }
    if (is_active !== undefined) {
      params.push(is_active)
      conditions.push(`p.is_active = $${paramIndex++}`)
    }
    if (featured !== undefined) {
      params.push(featured)
      conditions.push(`p.is_featured = $${paramIndex++}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description_text ILIKE $${paramIndex} OR p.tags::text ILIKE $${paramIndex})`)
      paramIndex++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderBy = sort === 'price_asc' ? 'ORDER BY p.price ASC' :
      sort === 'price_desc' ? 'ORDER BY p.price DESC' :
      sort === 'newest' ? 'ORDER BY p.created_at DESC' :
      'ORDER BY p.created_at DESC'

    const countQuery = `SELECT COUNT(*) FROM products p ${collection ? 'JOIN product_collections pc ON pc.product_id = p.id' : ''} ${where}`
    const { rows: [{ count }] } = await this.db.query(countQuery, params)

    params.push(limit, offset)
    const dataQuery = `
      SELECT p.*,
        (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'alt_text', pi.alt_text, 'position', pi.position, 'is_primary', pi.is_primary) ORDER BY pi.position) FROM product_images pi WHERE pi.product_id = p.id) as images,
        (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'title', pv.title, 'price', pv.price, 'option1', pv.option1, 'option2', pv.option2, 'option3', pv.option3)) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true) as variants
      FROM products p
      ${collection ? 'JOIN product_collections pc ON pc.product_id = p.id' : ''}
      ${where} ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `
    const { rows } = await this.db.query(dataQuery, params)
    return { data: rows, total: parseInt(count), page, limit }
  }

  async getBySlug(slug: string) {
    const { rows } = await this.db.query(`
      SELECT p.*,
        (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'cloudinary_id', pi.cloudinary_id, 'url', pi.url, 'alt_text', pi.alt_text, 'position', pi.position, 'is_primary', pi.is_primary) ORDER BY pi.position) FROM product_images pi WHERE pi.product_id = p.id) as images,
        (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'title', pv.title, 'price', pv.price, 'sku', pv.sku, 'option1', pv.option1, 'option2', pv.option2, 'option3', pv.option3, 'image_id', pv.image_id)) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = true) as variants,
        (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)) FROM product_collections pc JOIN collections c ON c.id = pc.collection_id WHERE pc.product_id = p.id) as collections
      FROM products p WHERE p.slug = $1
    `, [slug])
    return rows[0] || null
  }

  async getById(id: string) {
    const { rows } = await this.db.query('SELECT * FROM products WHERE id = $1', [id])
    return rows[0] || null
  }

  async create(data: {
    name: string; slug: string; description_html?: string; description_text?: string;
    price: number; compare_at_price?: number; cost_price?: number; sku?: string;
    barcode?: string; weight_grams?: number; tags?: string[]; meta_title?: string;
    meta_description?: string; vendor?: string; collection_ids?: string[]
  }) {
    const { rows } = await this.db.query(`
      INSERT INTO products (name, slug, description_html, description_text, price, compare_at_price, cost_price, sku, barcode, weight_grams, tags, meta_title, meta_description, vendor)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [data.name, data.slug, data.description_html || null, data.description_text || null, data.price, data.compare_at_price || null, data.cost_price || null, data.sku || null, data.barcode || null, data.weight_grams || null, data.tags || null, data.meta_title || null, data.meta_description || null, data.vendor || null])

    if (data.collection_ids?.length) {
      const values = data.collection_ids.map((_, i) => `($1, $${i + 2})`).join(', ')
      await this.db.query(`INSERT INTO product_collections (product_id, collection_id) VALUES ${values} ON CONFLICT DO NOTHING`, [rows[0].id, ...data.collection_ids])
    }

    return rows[0]
  }

  async update(id: string, data: Partial<{
    name: string; slug: string; description_html: string; description_text: string;
    price: number; compare_at_price: number; cost_price: number; sku: string;
    barcode: string; weight_grams: number; is_active: boolean; is_featured: boolean;
    tags: string[]; meta_title: string; meta_description: string; vendor: string;
    collection_ids: string[]
  }>) {
    const fields: string[] = []
    const params: any[] = [id]
    let paramIndex = 2

    for (const [key, value] of Object.entries(data)) {
      if (key === 'collection_ids') continue
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }

    if (fields.length) {
      fields.push('updated_at = now()')
      await this.db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $1`, params)
    }

    if (data.collection_ids !== undefined) {
      await this.db.query('DELETE FROM product_collections WHERE product_id = $1', [id])
      if (data.collection_ids.length) {
        const values = data.collection_ids.map((_, i) => `($1, $${i + 2})`).join(', ')
        await this.db.query(`INSERT INTO product_collections (product_id, collection_id) VALUES ${values} ON CONFLICT DO NOTHING`, [id, ...data.collection_ids])
      }
    }

    return this.getById(id)
  }

  async softDelete(id: string) {
    await this.db.query('UPDATE products SET is_active = false, updated_at = now() WHERE id = $1', [id])
  }

  async getRecommendations(slug: string) {
    const product = await this.getBySlug(slug)
    if (!product) return []

    const { rows: collectionIds } = await this.db.query('SELECT collection_id FROM product_collections WHERE product_id = $1', [product.id])
    const ids = collectionIds.map((r: any) => r.collection_id)

    if (ids.length) {
      const { rows } = await this.db.query(`
        SELECT p.*, pi.url as primary_image_url
        FROM products p
        JOIN product_collections pc ON pc.product_id = p.id
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
        WHERE pc.collection_id = ANY($1::uuid[]) AND p.id != $2 AND p.is_active = true
        GROUP BY p.id, pi.url
        ORDER BY p.created_at DESC
        LIMIT 8
      `, [ids, product.id])

      if (rows.length >= 4) return rows
    }

    const { rows } = await this.db.query(`
      SELECT p.*, pi.url as primary_image_url
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
      WHERE p.id != $1 AND p.is_active = true
      GROUP BY p.id, pi.url
      ORDER BY p.created_at DESC
      LIMIT 8
    `, [product.id])
    return rows
  }
}
