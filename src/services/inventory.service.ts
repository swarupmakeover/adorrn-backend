export class InventoryService {
  constructor(private db: any) {}

  async getProductStock(productId: string) {
    const { rows } = await this.db.query(`
      SELECT pss.*, s.label as size_label, s.sort_order as size_sort_order,
        pv.title as variant_title
      FROM product_size_stock pss
      JOIN sizes s ON s.id = pss.size_id
      JOIN product_variants pv ON pv.id = pss.variant_id
      WHERE pss.product_id = $1
      ORDER BY pv.title, s.sort_order
    `, [productId])
    return rows
  }

  async upsertStock(data: { product_id: string; variant_id: string; size_id: string; stock: number; sku?: string }) {
    const { rows: [stock] } = await this.db.query(`
      INSERT INTO product_size_stock (product_id, variant_id, size_id, stock, sku)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (variant_id, size_id)
      DO UPDATE SET stock = $4, sku = COALESCE($5, product_size_stock.sku)
      RETURNING *
    `, [data.product_id, data.variant_id, data.size_id, data.stock, data.sku || null])
    return stock
  }

  async adjustStock(stockId: string, change: number, reason: string, referenceId?: string) {
    const { rows: [stock] } = await this.db.query(
      'UPDATE product_size_stock SET stock = stock + $2 WHERE id = $1 RETURNING *',
      [stockId, change]
    )
    await this.db.query(
      'INSERT INTO inventory_logs (product_size_stock_id, change, reason, reference_id) VALUES ($1, $2, $3, $4)',
      [stockId, change, reason, referenceId || null]
    )
    return stock
  }

  async listLowStock(threshold = 5) {
    const { rows } = await this.db.query(`
      SELECT pss.*, p.name as product_name, p.sku as product_sku,
        pv.title as variant_title, s.label as size_label
      FROM product_size_stock pss
      JOIN products p ON p.id = pss.product_id
      JOIN product_variants pv ON pv.id = pss.variant_id
      JOIN sizes s ON s.id = pss.size_id
      WHERE pss.stock <= $1 AND p.is_active = true
      ORDER BY pss.stock ASC
    `, [threshold])
    return rows
  }
}
