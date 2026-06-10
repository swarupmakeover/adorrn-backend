import { FastifyInstance } from 'fastify'
import { InventoryService } from '../services/inventory.service.js'

export default async function inventoryRoutes(app: FastifyInstance) {
  const inventoryService = new InventoryService(app.db)

  app.get('/low-stock', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'List low stock items (admin)',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { threshold: { type: 'integer', default: 5 } },
      },
    },
  }, async (request, reply) => {
    const { threshold } = request.query as any
    const items = await inventoryService.listLowStock(threshold)
    return items
  })

  app.post('/adjust', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Adjust stock manually (admin)',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['stock_id', 'change', 'reason'],
        properties: {
          stock_id: { type: 'string' },
          change: { type: 'integer' },
          reason: { type: 'string' },
          reference_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { stock_id, change, reason, reference_id } = request.body as any
    const stock = await inventoryService.adjustStock(stock_id, change, reason, reference_id)
    return stock
  })

  app.get('/logs', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get inventory change logs (admin)',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { page = 1, limit = 50 } = request.query as any
    const offset = (page - 1) * limit
    const { rows: [{ count }] } = await app.db.query('SELECT COUNT(*) FROM inventory_logs')
    const { rows } = await app.db.query(`
      SELECT il.*, pss.product_id, pss.variant_id, pss.size_id,
        p.name as product_name, pv.title as variant_title, s.label as size_label
      FROM inventory_logs il
      JOIN product_size_stock pss ON pss.id = il.product_size_stock_id
      JOIN products p ON p.id = pss.product_id
      JOIN product_variants pv ON pv.id = pss.variant_id
      JOIN sizes s ON s.id = pss.size_id
      ORDER BY il.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset])
    return { data: rows, total: parseInt(count), page, limit }
  })
}
