-- ─────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'customer',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  ADDRESSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT,
  line1           TEXT NOT NULL,
  line2           TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  country         TEXT DEFAULT 'IN',
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  COLLECTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description_html  TEXT,
  description_text  TEXT,
  price             NUMERIC(10,2) NOT NULL,
  compare_at_price  NUMERIC(10,2),
  cost_price        NUMERIC(10,2),
  sku               TEXT UNIQUE,
  barcode           TEXT,
  weight_grams      INT,
  is_active         BOOLEAN DEFAULT true,
  is_featured       BOOLEAN DEFAULT false,
  tags              TEXT[],
  meta_title        TEXT,
  meta_description  TEXT,
  vendor            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  PRODUCT <-> COLLECTION
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_collections (
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

-- ─────────────────────────────────────────────
--  PRODUCT IMAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  cloudinary_id   TEXT NOT NULL,
  url             TEXT NOT NULL,
  alt_text        TEXT,
  position        INT DEFAULT 0,
  is_primary      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  PRODUCT VARIANTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  option1         TEXT,
  option2         TEXT,
  option3         TEXT,
  price           NUMERIC(10,2),
  sku             TEXT,
  image_id        UUID REFERENCES product_images(id),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  SIZE GROUPS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS size_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  SIZES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sizes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_group_id   UUID REFERENCES size_groups(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  PRODUCT SIZE STOCK
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_size_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  size_id         UUID REFERENCES sizes(id) ON DELETE CASCADE,
  stock           INT NOT NULL DEFAULT 0,
  sku             TEXT,
  UNIQUE (variant_id, size_id)
);

-- ─────────────────────────────────────────────
--  INVENTORY LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_size_stock_id UUID REFERENCES product_size_stock(id),
  change                INT NOT NULL,
  reason                TEXT,
  reference_id          UUID,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  COUPONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL,
  value               NUMERIC(10,2),
  applies_to          TEXT NOT NULL DEFAULT 'order',
  product_ids         UUID[],
  collection_ids      UUID[],
  excluded_product_ids UUID[],
  buy_quantity        INT,
  get_quantity        INT,
  get_product_ids     UUID[],
  min_order_value     NUMERIC(10,2) DEFAULT 0,
  min_item_quantity   INT DEFAULT 0,
  max_discount_amount NUMERIC(10,2),
  first_order_only    BOOLEAN DEFAULT false,
  new_customers_only  BOOLEAN DEFAULT false,
  max_uses            INT,
  max_uses_per_user   INT DEFAULT 1,
  used_count          INT DEFAULT 0,
  starts_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT true,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  COUPON USAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id    UUID,
  used_at     TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  HOMEPAGE CMS - HERO SLIDES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hero_slides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT,
  subtitle        TEXT,
  cta_label       TEXT,
  cta_url         TEXT,
  desktop_image_cloudinary_id TEXT NOT NULL,
  desktop_image_url           TEXT NOT NULL,
  mobile_image_cloudinary_id  TEXT,
  mobile_image_url            TEXT,
  text_color      TEXT DEFAULT '#ffffff',
  overlay_opacity NUMERIC(3,2) DEFAULT 0.3,
  position        INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  HOMEPAGE FEATURED PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homepage_featured_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  position    INT DEFAULT 0,
  label       TEXT,
  is_active   BOOLEAN DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  TESTIMONIALS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name     TEXT NOT NULL,
  author_title    TEXT,
  avatar_cloudinary_id TEXT,
  avatar_url      TEXT,
  body            TEXT NOT NULL,
  rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
  source          TEXT,
  source_url      TEXT,
  position        INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  HOMEPAGE SECTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homepage_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  is_visible  BOOLEAN DEFAULT true,
  title       TEXT,
  subtitle    TEXT,
  sort_order  INT DEFAULT 0,
  config      JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  CARTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id      TEXT,
  expires_at      TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  CART ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id),
  quantity        INT NOT NULL DEFAULT 1,
  added_at        TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  subtotal        NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  shipping_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  discount_id     UUID REFERENCES coupons(id),
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  ORDER ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id),
  size_id         UUID REFERENCES sizes(id),
  product_name    TEXT NOT NULL,
  variant_title   TEXT,
  size_label      TEXT,
  quantity        INT NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  total_price     NUMERIC(10,2) NOT NULL,
  image_url       TEXT
);

-- ─────────────────────────────────────────────
--  ORDER STATUS HISTORY
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  status          TEXT NOT NULL,
  note            TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'created',
  method          TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  REVIEWS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  order_item_id   UUID REFERENCES order_items(id),
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           TEXT,
  body            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  REVIEW IMAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
  cloudinary_id   TEXT NOT NULL,
  url             TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
--  REVIEW HELPFUL VOTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, user_id)
);

-- ─────────────────────────────────────────────
--  WISHLISTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  added_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ─────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_size_stock_variant ON product_size_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_hero_slides_active ON hero_slides(is_active, position);
CREATE INDEX IF NOT EXISTS idx_testimonials_active ON testimonials(is_active, position);
CREATE INDEX IF NOT EXISTS idx_homepage_featured ON homepage_featured_products(is_active, position);
