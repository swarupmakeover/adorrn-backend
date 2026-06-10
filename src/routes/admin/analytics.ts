import { FastifyInstance } from 'fastify'

export default async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.get('/analytics/overview', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get analytics overview (total revenue, orders, customers)',
      tags: ['Admin - Analytics'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const { rows: [revenue] } = await app.db.query(`
      SELECT COALESCE(SUM(total), 0) as total_revenue,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
        COUNT(*) FILTER (WHERE status = 'shipped') as shipped_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders
      FROM orders WHERE created_at >= date_trunc('month', now())
    `)

    const { rows: [{ total_customers }] } = await app.db.query(`
      SELECT COUNT(*) as total_customers FROM users WHERE role = 'customer'
    `)

    const { rows: [{ mtd_customers }] } = await app.db.query(`
      SELECT COUNT(*) as mtd_customers FROM users
      WHERE role = 'customer' AND created_at >= date_trunc('month', now())
    `)

    const { rows: [{ avg_order_value }] } = await app.db.query(`
      SELECT COALESCE(AVG(total), 0) as avg_order_value FROM orders
      WHERE status NOT IN ('cancelled', 'refunded')
    `)

    return {
      mtd_revenue: parseFloat(revenue.total_revenue),
      mtd_orders: parseInt(revenue.total_orders),
      order_status_breakdown: {
        pending: parseInt(revenue.pending_orders),
        confirmed: parseInt(revenue.confirmed_orders),
        shipped: parseInt(revenue.shipped_orders),
        delivered: parseInt(revenue.delivered_orders),
        cancelled: parseInt(revenue.cancelled_orders),
      },
      total_customers: parseInt(total_customers),
      mtd_customers: parseInt(mtd_customers),
      avg_order_value: parseFloat(avg_order_value),
    }
  })

  app.get('/analytics/revenue', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Revenue over time (day/week/month)',
      tags: ['Admin - Analytics'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
        },
      },
    },
  }, async (request, reply) => {
    const { period = 'month' } = request.query as any
    const interval = period === 'day' ? 'hour' : period === 'week' ? 'day' : 'day'
    const range = period === 'day' ? '1 day' : period === 'week' ? '7 days' : '30 days'

    const { rows } = await app.db.query(`
      SELECT date_trunc($1, created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= now() - $2::interval
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY date_trunc($1, created_at)
      ORDER BY date ASC
    `, [interval, range])

    return rows
  })

  app.get('/analytics/top-products', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Top selling products by revenue',
      tags: ['Admin - Analytics'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT oi.product_name, oi.variant_title, oi.image_url,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('cancelled', 'refunded')
      GROUP BY oi.product_name, oi.variant_title, oi.image_url
      ORDER BY total_revenue DESC
      LIMIT 10
    `)
    return rows
  })

  app.get('/analytics/orders-by-status', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Order status breakdown',
      tags: ['Admin - Analytics'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders
      GROUP BY status
      ORDER BY status
    `)
    return rows
  })

  app.get('/analytics/recent-orders', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Latest 10 orders',
      tags: ['Admin - Analytics'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const { rows } = await app.db.query(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 10
    `)
    return rows
  })
}
