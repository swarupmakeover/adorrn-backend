import { FastifyInstance } from 'fastify'

export default async function adminFrontendRoutes(app: FastifyInstance) {
  // ── Dashboard ──────────────────────────────────────────────

  app.get('/dashboard/stats', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows: [mtd] } = await app.db.query(`
      SELECT COALESCE(SUM(total), 0) as total_revenue,
        COUNT(*) as total_orders
      FROM orders WHERE created_at >= date_trunc('month', now()) AND status NOT IN ('cancelled', 'refunded')
    `)
    const { rows: [{ new_customers }] } = await app.db.query(`
      SELECT COUNT(*) as new_customers FROM users
      WHERE role = 'customer' AND created_at >= date_trunc('month', now())
    `)
    const { rows: [{ avg_order_value }] } = await app.db.query(`
      SELECT COALESCE(AVG(total), 0) as avg_order_value FROM orders
      WHERE status NOT IN ('cancelled', 'refunded')
    `)
    return {
      total_revenue: parseFloat(mtd.total_revenue),
      total_orders: parseInt(mtd.total_orders),
      new_customers: parseInt(new_customers),
      avg_order_value: parseFloat(avg_order_value),
    }
  })

  app.get('/dashboard/revenue', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { period = 'monthly' } = request.query as any
    const interval = period === 'daily' ? 'hour' : period === 'weekly' ? 'day' : 'day'
    const range = period === 'daily' ? '1 day' : period === 'weekly' ? '7 days' : '30 days'

    const { rows } = await app.db.query(`
      SELECT date_trunc($1, created_at) as date,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= now() - $2::interval AND status NOT IN ('cancelled', 'refunded')
      GROUP BY date_trunc($1, created_at) ORDER BY date ASC
    `, [interval, range])

    return rows.map((r: any) => ({
      label: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(r.revenue),
    }))
  })

  app.get('/dashboard/top-products', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT oi.product_name as name, oi.image_url,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled', 'refunded')
      GROUP BY oi.product_name, oi.image_url
      ORDER BY total_revenue DESC LIMIT 10
    `)
    return rows.map((r: any) => ({
      ...r,
      sales_count: parseInt(r.total_sold),
      revenue: parseFloat(r.total_revenue),
      total_sold: parseInt(r.total_sold),
      total_revenue: parseFloat(r.total_revenue),
    }))
  })

  app.get('/dashboard/recent-orders', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT o.*, u.name as customer_name
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 10
    `)
    return rows
  })

  app.get('/dashboard/order-status', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT status, COUNT(*)::int as count FROM orders GROUP BY status
    `)
    const result: Record<string, number> = {
      pending: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0,
    }
    for (const r of rows) result[r.status] = parseInt(r.count)
    return result
  })

  // ── Products (admin) ───────────────────────────────────────

  app.get('/products', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { page = 1, limit = 15, search, is_active } = request.query as any
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []
    let pi = 1
    if (search) { conditions.push(`(p.name ILIKE $${pi} OR p.sku ILIKE $${pi})`); params.push(`%${search}%`); pi++ }
    if (is_active !== undefined) { conditions.push(`p.is_active = $${pi}`); params.push(is_active === 'true'); pi++ }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows: [{ count }] } = await app.db.query(`SELECT COUNT(*) FROM products p ${where}`, params)
    params.push(limit, offset)
    const { rows } = await app.db.query(`
      SELECT p.*,
        COALESCE((SELECT SUM(stock) FROM product_size_stock WHERE product_id = p.id), 0) as total_stock,
        (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'is_primary', pi.is_primary) ORDER BY pi.position) FROM product_images pi WHERE pi.product_id = p.id) as images
      FROM products p ${where}
      ORDER BY p.created_at DESC LIMIT $${pi++} OFFSET $${pi}
    `, params)
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  })

  app.get('/products/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    const { rows: [product] } = await app.db.query('SELECT * FROM products WHERE id = $1', [id])
    if (!product) return reply.status(404).send({ error: 'Product not found' })
    const { rows: variants } = await app.db.query('SELECT * FROM product_variants WHERE product_id = $1', [id])
    const { rows: images } = await app.db.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY position', [id])
    const { rows: cols } = await app.db.query(
      'SELECT c.id, c.name FROM collections c JOIN product_collections pc ON pc.collection_id = c.id WHERE pc.product_id = $1', [id]
    )
    return { ...product, variants, images, collections: cols }
  })

  app.post('/products', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const data = request.body as any
    const { rows: [product] } = await app.db.query(`
      INSERT INTO products (name, slug, description_html, price, compare_at_price, sku, is_active, is_featured, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [data.name, data.slug, data.description_html || null, data.price, data.compare_at_price || null,
      data.sku || null, data.is_active !== false, data.is_featured || false, data.tags || null])
    if (data.collection_ids?.length) {
      for (const cid of data.collection_ids) {
        await app.db.query('INSERT INTO product_collections (product_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [product.id, cid])
      }
    }
    if (data.variants?.length) {
      for (const v of data.variants) {
        await app.db.query('INSERT INTO product_variants (product_id, title, option1, price, sku, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
          [product.id, v.title, v.option1 || null, v.price || data.price, v.sku || null, v.is_active !== false])
      }
    }
    reply.status(201).send(product)
  })

  app.put('/products/:id', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { id } = request.params as any
    const data = request.body as any
    const fields: string[] = []; const params: any[] = [id]; let pi = 2
    for (const key of ['name', 'slug', 'description_html', 'price', 'compare_at_price', 'sku', 'is_active', 'is_featured', 'tags']) {
      if (data[key] !== undefined) { fields.push(`${key} = $${pi++}`); params.push(key === 'price' || key === 'compare_at_price' ? data[key] : data[key]) }
    }
    if (fields.length) {
      fields.push('updated_at = now()')
      await app.db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = $1`, params)
    }
    if (data.collection_ids) {
      await app.db.query('DELETE FROM product_collections WHERE product_id = $1', [id])
      for (const cid of data.collection_ids) {
        await app.db.query('INSERT INTO product_collections (product_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, cid])
      }
    }
    if (data.variants) {
      await app.db.query('DELETE FROM product_variants WHERE product_id = $1', [id])
      for (const v of data.variants) {
        await app.db.query('INSERT INTO product_variants (product_id, title, option1, price, sku, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, v.title, v.option1 || null, v.price || null, v.sku || null, v.is_active !== false])
      }
    }
    const { rows: [product] } = await app.db.query('SELECT * FROM products WHERE id = $1', [id])
    return product
  })

  app.delete('/products/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    await app.db.query('UPDATE products SET is_active = false, updated_at = now() WHERE id = $1', [id])
    reply.status(200).send({ success: true })
  })

  // ── Customers ─────────────────────────────────────────────

  app.get('/customers', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { page = 1, limit = 20, search } = request.query as any
    const offset = (page - 1) * limit
    const conditions: string[] = ['role = $1']
    const params: any[] = ['customer']
    let pi = 2
    if (search) { conditions.push(`(name ILIKE $${pi} OR email ILIKE $${pi})`); params.push(`%${search}%`); pi++ }
    const where = `WHERE ${conditions.join(' AND ')}`
    const { rows: [{ count }] } = await app.db.query(`SELECT COUNT(*) FROM users ${where}`, params)
    params.push(limit, offset)
    const { rows } = await app.db.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id AND status NOT IN ('cancelled', 'refunded')) as total_spent
      FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${pi++} OFFSET $${pi}
    `, params)
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  })

  app.get('/customers/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    const { rows: [user] } = await app.db.query('SELECT * FROM users WHERE id = $1', [id])
    if (!user) return reply.status(404).send({ error: 'Customer not found' })
    const { rows: [{ orders_count }] } = await app.db.query('SELECT COUNT(*) FROM orders WHERE user_id = $1', [id])
    const { rows: [{ total_spent }] } = await app.db.query(
      "SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'refunded')", [id]
    )
    const { rows: recent_orders } = await app.db.query(
      'SELECT id, order_number, status, total, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [id]
    )
    return { ...user, orders_count: parseInt(orders_count), total_spent: parseFloat(total_spent), recent_orders }
  })

  // ── Reviews (admin) ────────────────────────────────────────

  app.get('/reviews', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { status, page = 1, limit = 20 } = request.query as any
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []; let pi = 1
    if (status) { conditions.push(`r.status = $${pi++}`); params.push(status) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows: [{ count }] } = await app.db.query(`SELECT COUNT(*) FROM reviews r ${where}`, params)
    params.push(limit, offset)
    const { rows } = await app.db.query(`
      SELECT r.*, u.name as author_name, u.email as author_email, p.name as product_name,
        (SELECT jsonb_agg(jsonb_build_object('id', ri.id, 'url', ri.url)) FROM review_images ri WHERE ri.review_id = r.id) as images
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN products p ON p.id = r.product_id
      ${where} ORDER BY r.created_at DESC LIMIT $${pi++} OFFSET $${pi}
    `, params)
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  })

  app.patch('/reviews/:id/status', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any; const { status } = request.body as any
    const { rows: [review] } = await app.db.query('UPDATE reviews SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, id])
    if (!review) return reply.status(404).send({ error: 'Review not found' })
    return review
  })

  app.delete('/reviews/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    await app.db.query('DELETE FROM reviews WHERE id = $1', [id])
    reply.status(204).send()
  })

  // ── Coupons (admin) ────────────────────────────────────────

  app.get('/coupons', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query as any
    const offset = (page - 1) * limit
    const { rows: [{ count }] } = await app.db.query('SELECT COUNT(*) FROM coupons')
    const { rows } = await app.db.query('SELECT * FROM coupons ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  })

  app.get('/coupons/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    const { rows: [coupon] } = await app.db.query('SELECT * FROM coupons WHERE id = $1', [id])
    if (!coupon) return reply.status(404).send({ error: 'Coupon not found' })
    return coupon
  })

  app.post('/coupons', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const data = request.body as any
    let createdBy: string | undefined
    if (request.userId) {
      const { rows: [u] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [request.userId])
      createdBy = u?.id
    }
    const { rows: [coupon] } = await app.db.query(`
      INSERT INTO coupons (code, description, type, value, applies_to, min_order_value, max_discount_amount, max_uses, max_uses_per_user, first_order_only, starts_at, expires_at, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
    `, [(data.code || '').toUpperCase(), data.description || null, data.type, data.value || null,
      data.applies_to || 'order', data.min_order_value || 0, data.max_discount_amount || null,
      data.max_uses || null, data.max_uses_per_user || 1, data.first_order_only || false,
      data.starts_at || null, data.expires_at || null, data.is_active !== false, createdBy || null])
    reply.status(201).send(coupon)
  })

  app.put('/coupons/:id', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { id } = request.params as any; const data = request.body as any
    const fields: string[] = []; const params: any[] = [id]; let pi = 2
    for (const key of ['code', 'description', 'type', 'value', 'applies_to', 'min_order_value', 'max_discount_amount', 'max_uses', 'max_uses_per_user', 'first_order_only', 'starts_at', 'expires_at', 'is_active']) {
      if (data[key] !== undefined) { fields.push(`${key} = $${pi++}`); params.push(key === 'code' ? String(data[key]).toUpperCase() : data[key]) }
    }
    if (fields.length) { fields.push('updated_at = now()'); await app.db.query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = $1`, params) }
    const { rows: [coupon] } = await app.db.query('SELECT * FROM coupons WHERE id = $1', [id])
    return coupon
  })

  app.delete('/coupons/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any
    await app.db.query('UPDATE coupons SET is_active = false, updated_at = now() WHERE id = $1', [id])
    reply.status(200).send({ success: true })
  })

  app.get('/coupons/:id/usage', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { id } = request.params as any
    const { rows } = await app.db.query(`
      SELECT cu.*, u.name as customer_name, u.email as customer_email
      FROM coupon_usages cu LEFT JOIN users u ON u.id = cu.user_id
      WHERE cu.coupon_id = $1 ORDER BY cu.used_at DESC
    `, [id])
    return rows
  })

  // ── Homepage CMS ──────────────────────────────────────────

  app.get('/homepage', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows: sections } = await app.db.query('SELECT * FROM homepage_sections ORDER BY sort_order')
    const { rows: heroSlides } = await app.db.query('SELECT * FROM hero_slides WHERE is_active = true ORDER BY position')
    const { rows: featured } = await app.db.query(
      'SELECT hfp.*, p.name, p.slug FROM homepage_featured_products hfp JOIN products p ON p.id = hfp.product_id WHERE hfp.is_active = true ORDER BY hfp.position'
    )
    const { rows: testimonials } = await app.db.query('SELECT * FROM testimonials WHERE is_active = true ORDER BY position')
    return { sections, hero_slides: heroSlides, featured_products: featured, testimonials }
  })

  app.put('/homepage', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const data = request.body as any
    if (data.sections) {
      for (const s of data.sections) {
        await app.db.query('UPDATE homepage_sections SET title = $1, is_visible = $2, updated_at = now() WHERE key = $3',
          [s.title, s.is_visible !== false, s.key])
      }
    }
    if (data.hero_slides) {
      await app.db.query('UPDATE hero_slides SET is_active = false WHERE is_active = true')
      for (const h of data.hero_slides) {
        if (h.id) {
          const { rowCount } = await app.db.query(`
            UPDATE hero_slides SET title = $1, subtitle = $2, cta_label = $3, cta_url = $4,
              desktop_image_url = $5, mobile_image_url = $6, overlay_opacity = $7,
              position = $8, is_active = true, updated_at = now()
            WHERE id = $9
          `, [h.title || null, h.subtitle || null, h.cta_label || null, h.cta_url || null,
            h.desktop_image_url || h.image_url || '', h.mobile_image_url || null,
            h.overlay_opacity ?? 0.3, h.position || 0, h.id])
          if (rowCount === 0) {
            await app.db.query(`
              INSERT INTO hero_slides (id, title, subtitle, cta_label, cta_url,
                desktop_image_cloudinary_id, desktop_image_url, mobile_image_url,
                overlay_opacity, position, is_active)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
            `, [h.id, h.title || null, h.subtitle || null, h.cta_label || null, h.cta_url || null,
              'placeholder', h.desktop_image_url || h.image_url || '', h.mobile_image_url || null,
              h.overlay_opacity ?? 0.3, h.position || 0])
          }
        } else {
          await app.db.query(`
            INSERT INTO hero_slides (title, subtitle, cta_label, cta_url,
              desktop_image_cloudinary_id, desktop_image_url, mobile_image_url,
              overlay_opacity, position)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [h.title || null, h.subtitle || null, h.cta_label || null, h.cta_url || null,
            'placeholder', h.desktop_image_url || h.image_url || '', h.mobile_image_url || null,
            h.overlay_opacity ?? 0.3, h.position || 0])
        }
      }
    }
    if (data.featured_product_ids) {
      await app.db.query('DELETE FROM homepage_featured_products')
      for (let i = 0; i < data.featured_product_ids.length; i++) {
        await app.db.query('INSERT INTO homepage_featured_products (product_id, position) VALUES ($1, $2)', [data.featured_product_ids[i], i])
      }
    }
    if (data.testimonials) {
      await app.db.query('UPDATE testimonials SET is_active = false')
      for (const t of data.testimonials) {
        if (t.id) {
          const { rowCount } = await app.db.query(`
            UPDATE testimonials SET author_name = $1, body = $2, source = $3,
              avatar_url = $4, rating = $5, position = $6,
              is_active = true, updated_at = now()
            WHERE id = $7
          `, [t.author || t.author_name, t.quote || t.body, t.source || null,
            t.avatar_url || null, t.rating || null, t.position ?? 0, t.id])
          if (rowCount === 0) {
            await app.db.query(`
              INSERT INTO testimonials (id, author_name, body, source, avatar_url, rating, position, is_active)
              VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            `, [t.id, t.author || t.author_name, t.quote || t.body, t.source || null,
              t.avatar_url || null, t.rating || null, t.position ?? 0])
          }
        } else {
          await app.db.query(`
            INSERT INTO testimonials (author_name, body, source, avatar_url, rating, position, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
          `, [t.author || t.author_name, t.quote || t.body, t.source || null,
            t.avatar_url || null, t.rating || null, t.position ?? 0])
        }
      }
    }
    return { success: true }
  })

  // ── Settings ───────────────────────────────────────────────

  app.get('/settings', {
    preHandler: [app.requireAdmin],
  }, async () => {
    const { rows } = await app.db.query("SELECT key, value FROM store_settings")
    const settings: Record<string, any> = {}
    for (const r of rows) settings[r.key] = r.value
    return settings
  })

  app.put('/settings', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const data = request.body as any
    for (const [key, value] of Object.entries(data)) {
      await app.db.query(
        'INSERT INTO store_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, JSON.stringify(value)]
      )
    }
    return { success: true }
  })

  // ── Inventory (admin) ──────────────────────────────────────

  app.get('/inventory', {
    preHandler: [app.requireAdmin],
  }, async (request) => {
    const { page = 1, limit = 50, low_stock, threshold = 5 } = request.query as any
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []; let pi = 1
    if (low_stock === 'true') { conditions.push(`pss.stock <= $${pi++}`); params.push(parseInt(threshold)) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows: [{ count }] } = await app.db.query(`SELECT COUNT(*) FROM product_size_stock pss ${where}`, params)
    params.push(limit, offset)
    const { rows } = await app.db.query(`
      SELECT pss.*, p.name as product_name, p.sku as product_sku, pv.title as variant_title, s.label as size_label
      FROM product_size_stock pss
      JOIN products p ON p.id = pss.product_id
      JOIN product_variants pv ON pv.id = pss.variant_id
      JOIN sizes s ON s.id = pss.size_id
      ${where} ORDER BY p.name, pv.title, s.sort_order LIMIT $${pi++} OFFSET $${pi}
    `, params)
    return { data: rows, total: parseInt(count), totalPages: Math.ceil(parseInt(count) / limit), page, limit }
  })

  app.patch('/inventory/:id', {
    preHandler: [app.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as any; const { quantity, reason } = request.body as any
    const { rows: [stock] } = await app.db.query('SELECT stock FROM product_size_stock WHERE id = $1', [id])
    if (!stock) return reply.status(404).send({ error: 'Stock entry not found' })
    const change = quantity - stock.stock
    const { rows: [updated] } = await app.db.query('UPDATE product_size_stock SET stock = $1 WHERE id = $2 RETURNING *', [quantity, id])
    await app.db.query('INSERT INTO inventory_logs (product_size_stock_id, change, reason) VALUES ($1, $2, $3)', [id, change, reason || 'Manual adjustment'])
    return updated
  })
}
