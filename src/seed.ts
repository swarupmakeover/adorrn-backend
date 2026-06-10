import 'dotenv/config'
import { Pool } from 'pg'

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(process.env.DATABASE_URL?.includes('neon.tech') ? { ssl: { rejectUnauthorized: false } } : {}),
  })

  // ── Homepage Sections ──
  await pool.query(`
    INSERT INTO homepage_sections (key, title, sort_order) VALUES
      ('hero', 'Hero Banners', 0),
      ('featured', 'Featured Products', 1),
      ('testimonials', 'Testimonials', 2),
      ('collections_grid', 'Collections', 3),
      ('marquee_text', 'Marquee Announcement', 4)
    ON CONFLICT (key) DO NOTHING
  `)

  // ── Size Groups ──
  const { rows: [weightGroup] } = await pool.query(`
    INSERT INTO size_groups (name) VALUES ('Weight') RETURNING id
  `)
  const { rows: [volumeGroup] } = await pool.query(`
    INSERT INTO size_groups (name) VALUES ('Volume') RETURNING id
  `)
  const { rows: [countGroup] } = await pool.query(`
    INSERT INTO size_groups (name) VALUES ('Count') RETURNING id
  `)

  // ── Sizes ──
  const sizes: Record<string, string> = {}
  for (const [label, groupId] of [
    ['25g', weightGroup.id], ['50g', weightGroup.id], ['100g', weightGroup.id], ['200g', weightGroup.id], ['500g', weightGroup.id], ['1kg', weightGroup.id],
    ['30ml', volumeGroup.id], ['100ml', volumeGroup.id], ['250ml', volumeGroup.id],
    ['1 Pack', countGroup.id], ['3 Pack', countGroup.id], ['6 Pack', countGroup.id],
  ]) {
    const { rows: [s] } = await pool.query(
      `INSERT INTO sizes (size_group_id, label, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
      [groupId, label, 0]
    )
    if (s) sizes[label] = s.id
  }

  // ── Collections ──
  const collections: Record<string, string> = {}
  for (const [name, slug, desc] of [
    ['Hair Care', 'hair-care', 'Natural solutions for healthy, lustrous hair'],
    ['Skin Care', 'skin-care', 'Ayurvedic formulations for radiant skin'],
    ['Wellness', 'wellness', 'Daily wellness supplements for a balanced life'],
    ['Digestive Health', 'digestive-health', 'Herbal remedies for gut health'],
    ['Immunity', 'immunity', 'Boost your natural defences'],
  ]) {
    const { rows: [c] } = await pool.query(
      `INSERT INTO collections (name, slug, description) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [name, slug, desc]
    )
    if (c) collections[slug] = c.id
  }

  // ── Products ──
  interface ProductDef {
    name: string; slug: string; desc: string; price: number; compare: number; tags: string[]; featured: boolean; collections: string[]; variants: { title: string; price: number; sku: string }[]
  }
  const productDefs: ProductDef[] = [
    { name: 'Amla & Bhringraj Hair Oil', slug: 'amla-bhringraj-hair-oil', desc: 'Traditional blend of amla and bhringraj for hair growth and strength. Enriched with coconut oil and essential vitamins.', price: 349, compare: 499, tags: ['hair', 'oil', 'amla'], featured: true, collections: ['hair-care'], variants: [{ title: '100ml', price: 349, sku: 'HAIR-OIL-100' }, { title: '250ml', price: 699, sku: 'HAIR-OIL-250' }] },
    { name: 'Neem & Tulsi Face Wash', slug: 'neem-tulsi-face-wash', desc: 'Gentle, soap-free face wash with neem and tulsi extracts. Controls acne and soothes irritated skin.', price: 249, compare: 0, tags: ['skin', 'face-wash', 'neem'], featured: true, collections: ['skin-care'], variants: [{ title: '100ml', price: 249, sku: 'FACEWASH-100' }, { title: '250ml', price: 449, sku: 'FACEWASH-250' }] },
    { name: 'Ashwagandha Capsules', slug: 'ashwagandha-capsules', desc: 'Standardized ashwagandha root extract 500mg. Supports stress management and vitality.', price: 599, compare: 799, tags: ['wellness', 'ashwagandha', 'stress'], featured: true, collections: ['wellness', 'immunity'], variants: [{ title: '30 Capsules', price: 599, sku: 'ASHWA-30' }, { title: '60 Capsules', price: 999, sku: 'ASHWA-60' }] },
    { name: 'Triphala Powder', slug: 'triphala-powder', desc: 'Classic Ayurvedic formulation of amla, bibhitaki, and haritaki. Supports gentle detox and digestion.', price: 299, compare: 0, tags: ['digestion', 'triphala', 'detox'], featured: false, collections: ['digestive-health', 'wellness'], variants: [{ title: '100g', price: 299, sku: 'TRIPH-100' }, { title: '200g', price: 499, sku: 'TRIPH-200' }] },
    { name: 'Turmeric & Honey Face Mask', slug: 'turmeric-honey-face-mask', desc: 'Brightening face mask with organic turmeric powder and raw honey. Natural glow without chemicals.', price: 399, compare: 549, tags: ['skin', 'mask', 'turmeric'], featured: true, collections: ['skin-care'], variants: [{ title: '50g', price: 399, sku: 'MASK-50' }, { title: '100g', price: 649, sku: 'MASK-100' }] },
    { name: 'Moringa Leaf Powder', slug: 'moringa-leaf-powder', desc: 'Pure moringa oleifera leaf powder. Rich in iron, calcium, and antioxidants.', price: 249, compare: 0, tags: ['wellness', 'moringa', 'nutrition'], featured: false, collections: ['wellness', 'immunity'], variants: [{ title: '100g', price: 249, sku: 'MORINGA-100' }, { title: '200g', price: 399, sku: 'MORINGA-200' }] },
    { name: 'Aloe Vera Gel', slug: 'aloe-vera-gel', desc: 'Pure aloe vera gel for sunburn relief and everyday moisturizing. No artificial colours or fragrances.', price: 199, compare: 349, tags: ['skin', 'aloe', 'moisturizer'], featured: false, collections: ['skin-care'], variants: [{ title: '100ml', price: 199, sku: 'ALOE-100' }, { title: '250ml', price: 349, sku: 'ALOE-250' }] },
    { name: 'Chyawanprash Classic', slug: 'chyawanprash-classic', desc: 'Traditional Ayurvedic jam with amla as the base. Fortified with 40+ herbs for daily immunity.', price: 449, compare: 599, tags: ['immunity', 'chyawanprash', 'ayurvedic'], featured: true, collections: ['immunity', 'wellness'], variants: [{ title: '500g', price: 449, sku: 'CHYAWAN-500' }, { title: '1kg', price: 799, sku: 'CHYAWAN-1K' }] },
    { name: 'Ginger & Lemon Herbal Tea', slug: 'ginger-lemon-herbal-tea', desc: 'Caffeine-free herbal tea blend with ginger, lemon, and tulsi. Soothing and refreshing.', price: 199, compare: 0, tags: ['tea', 'digestion', 'wellness'], featured: false, collections: ['digestive-health', 'wellness'], variants: [{ title: '30ml', price: 199, sku: 'TEA-30' }, { title: '100ml', price: 499, sku: 'TEA-100' }] },
    { name: 'Shikakai & Reetha Hair Wash', slug: 'shikakai-reetha-hair-wash', desc: 'Natural hair cleanser made from shikakai and reetha. A gentle, sulfate-free alternative to shampoo.', price: 299, compare: 449, tags: ['hair', 'shampoo', 'natural'], featured: false, collections: ['hair-care'], variants: [{ title: '100ml', price: 299, sku: 'HAIRWASH-100' }, { title: '250ml', price: 499, sku: 'HAIRWASH-250' }] },
  ]

  const productIds: string[] = []
  for (const p of productDefs) {
    const { rows: [prod] } = await pool.query(`
      INSERT INTO products (name, slug, description_html, description_text, price, compare_at_price, tags, is_featured)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (slug) DO UPDATE SET price = EXCLUDED.price RETURNING id
    `    , [p.name, p.slug, `<p>${p.desc}</p>`, p.desc, p.price, p.compare > 0 ? p.compare : null, p.tags, p.featured])
    productIds.push(prod.id)

    for (const colSlug of p.collections) {
      if (collections[colSlug]) {
        await pool.query(`INSERT INTO product_collections (product_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [prod.id, collections[colSlug]])
      }
    }

    await pool.query('DELETE FROM product_variants WHERE product_id = $1', [prod.id])
    for (const v of p.variants) {
      await pool.query(`
        INSERT INTO product_variants (product_id, title, price, sku)
        VALUES ($1, $2, $3, $4)
      `, [prod.id, v.title, v.price, v.sku])
    }
  }

  // ── Testimonials ──
  await pool.query(`
    INSERT INTO testimonials (author_name, author_title, body, rating, position) VALUES
      ('Priya Sharma', 'Yoga Instructor', 'The Ashwagandha capsules have made a noticeable difference in my stress levels. Highly recommend!', 5, 0),
      ('Rahul Patel', 'Software Engineer', 'I''ve been using the Triphala powder for a month now. My digestion has improved significantly.', 4, 1),
      ('Anita Desai', 'Homemaker', 'The Amla hair oil is amazing! My hair feels thicker and healthier after just a few weeks.', 5, 2),
      ('Vikram Singh', 'Fitness Coach', 'Moringa powder is now a staple in my daily smoothie. Great energy boost!', 4, 3)
    ON CONFLICT DO NOTHING
  `)

  // ── Hero Slides ──
  await pool.query(`
    INSERT INTO hero_slides (title, subtitle, cta_label, cta_url, desktop_image_cloudinary_id, desktop_image_url, position) VALUES
      ('Natural Wellness', 'Ayurvedic formulations for modern living', 'Shop Now', '/collections/wellness', 'placeholder', 'https://placehold.co/1200x400/2d6a4f/ffffff?text=Natural+Wellness', 0),
      ('Healthy Hair, Naturally', 'Amla, Bhringraj & more', 'Explore Hair Care', '/collections/hair-care', 'placeholder', 'https://placehold.co/1200x400/1b4332/ffffff?text=Healthy+Hair', 1),
      ('Glowing Skin', 'Chemical-free skincare from nature', 'Shop Skin Care', '/collections/skin-care', 'placeholder', 'https://placehold.co/1200x400/40916c/ffffff?text=Glowing+Skin', 2)
    ON CONFLICT DO NOTHING
  `)

  console.log('Seed complete')
  await pool.end()
}

seed().catch(console.error)
