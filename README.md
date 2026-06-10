# Adorrn Herbal — Backend API

REST API for the Adorrn Herbal e-commerce platform. Built with **Fastify** on **Railway**, backed by **Neon (PostgreSQL)**, and integrated with **Clerk** (auth), **Cloudinary** (media), and **Razorpay** (payments).

---

## Quick Start

### Option 1: Docker (recommended for local dev)

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy env config (already configured for Docker Postgres)
cp .env.example .env
# Then edit .env: fill in your Clerk, Cloudinary, Razorpay keys

# 4. Run migrations (schema is auto-loaded on first Docker start)
npm run db:migrate

# 5. Seed default data
npm run db:seed

# 6. Start dev server
npm run dev
```

### Option 2: Manual (existing Postgres)

```bash
npm install
cp .env.example .env
# Edit .env: point DATABASE_URL to your Postgres instance
npm run db:migrate
npm run db:seed
npm run dev
```

Server starts on **http://localhost:3001**.

Swagger UI (interactive API explorer): **http://localhost:3001/docs**

Health check: **http://localhost:3001/health**

---

## Docker Setup

A `docker-compose.yml` is included for zero-fuss local development:

```bash
# Start Postgres (in background)
docker compose up -d

# View logs
docker compose logs -f

# Stop and remove container (data persists in volume)
docker compose down

# Stop and delete everything including data
docker compose down -v
```

The Docker Compose configuration:
- Runs **PostgreSQL 16 Alpine** on port **5432**
- Uses credentials: `adorrn` / `adorrn_dev` / `adorrn_herbal`
- Auto-loads the schema from `migrations/001_schema.sql` on first start
- Persists data in a Docker volume named `adorrn-db-pgdata`

**.env** is pre-configured to connect to this Docker Postgres out of the box:
```
DATABASE_URL=postgresql://adorrn:adorrn_dev@localhost:5432/adorrn_herbal
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (test mode: `sk_test_*`) | Yes |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `RAZORPAY_KEY_ID` | Razorpay key ID (test: `rzp_test_*`) | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | Yes |
| `FRONTEND_URL` | Frontend origin for CORS | No |
| `INTERNAL_WEBHOOK_SECRET` | Secret for internal webhooks | No |
| `REVALIDATION_TOKEN` | Token for Next.js ISR revalidation | No |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (`development` / `production`) | No |

Use **test/sandbox keys** for development:
- **Clerk**: Clerk dashboard → API Keys → Test mode
- **Razorpay**: Razorpay dashboard → Settings → API Keys → Test mode
- **Cloudinary**: Free tier provides demo cloud with all features
- **Neon**: Free tier never-pause Postgres

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server from `dist/` |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:migrate` | Run database schema migration |
| `npm run db:seed` | Seed default data (homepage sections) |

---

## Project Structure

```
apps/api/
├── migrations/
│   └── 001_schema.sql         # Full database schema (21 tables + indexes)
├── src/
│   ├── server.ts               # Fastify server entry point
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── migrate.ts              # Migration runner script
│   ├── seed.ts                 # Seed script
│   ├── plugins/
│   │   ├── auth.ts             # Clerk JWT verification
│   │   ├── db.ts               # Neon PostgreSQL pool
│   │   └── cloudinary.ts       # Cloudinary SDK config
│   ├── services/
│   │   ├── product.service.ts  # Product CRUD, search, recommendations
│   │   ├── order.service.ts    # Order creation, status transitions
│   │   ├── payment.service.ts  # Razorpay signature verification
│   │   ├── review.service.ts   # Submit, moderate, aggregate ratings
│   │   ├── inventory.service.ts# Stock adjustments, low-stock alerts
│   │   ├── cart.service.ts     # Cart CRUD, guest→user merge
│   │   ├── coupon.service.ts   # Coupon validation engine
│   │   └── homepage.service.ts # CMS read/write for homepage
│   ├── routes/
│   │   ├── products.ts         # Products + images + stock + recommendations
│   │   ├── collections.ts      # Collection CRUD
│   │   ├── cart.ts             # Cart & cart items
│   │   ├── orders.ts           # Customer order endpoints
│   │   ├── payments.ts         # Razorpay order creation & verification
│   │   ├── reviews.ts          # Public + admin review management
│   │   ├── users.ts            # Profile, addresses, user sync
│   │   ├── coupons.ts          # Coupon validation + admin CRUD
│   │   ├── inventory.ts        # Stock management
│   │   ├── homepage.ts         # Homepage CMS endpoints
│   │   ├── sizes.ts            # Size groups & sizes
│   │   └── admin/
│   │       ├── analytics.ts    # Revenue, top products, order stats
│   │       └── dashboard.ts    # Order management, refunds
│   └── webhooks/
│       └── razorpay.ts         # Razorpay webhook receiver
├── .env.example                # Environment template
├── package.json
└── tsconfig.json
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <clerk_jwt_token>`.

### Products

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Public | List products (pagination, filters, sort) |
| GET | `/products/search?q=` | Public | Full-text search |
| GET | `/products/:slug` | Public | Single product with variants/images/collections |
| GET | `/products/:slug/recommendations` | Public | Latest products from same collections |
| POST | `/products` | Admin | Create product |
| PATCH | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Soft-delete product |
| GET | `/products/:id/images` | Public | Ordered image list |
| POST | `/products/:id/images` | Admin | Upload image (multipart) |
| PATCH | `/products/:id/images/:imgId` | Admin | Update image metadata |
| DELETE | `/products/:id/images/:imgId` | Admin | Delete image (DB + Cloudinary) |
| PATCH | `/products/:id/images/reorder` | Admin | Batch reorder images |
| GET | `/products/:id/stock` | Public | All variant+size stock |
| PUT | `/products/:id/stock` | Admin | Upsert full stock matrix |

### Collections

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/collections` | Public | All active collections |
| GET | `/collections/:slug` | Public | Collection with paginated products |
| POST | `/collections` | Admin | Create collection |
| PATCH | `/collections/:id` | Admin | Update collection |

### Cart

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart?session_id=` | Optional | Get cart by user or session |
| POST | `/cart/items` | Optional | Add item to cart |
| PATCH | `/cart/items/:id` | Optional | Update item quantity |
| DELETE | `/cart/items/:id` | Optional | Remove item |
| POST | `/cart/merge` | Customer | Merge guest cart on login |

### Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Customer | Create order from cart |
| GET | `/orders` | Customer | List own orders |
| GET | `/orders/:id` | Customer | Order detail |

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/create-order` | Customer | Create Razorpay order |
| POST | `/payments/verify` | Customer | Verify payment signature |
| POST | `/payments/webhook` | Razorpay | Webhook receiver (HMAC-verified) |

### Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reviews/product/:productId` | Public | Approved reviews (paginated) |
| GET | `/reviews/product/:productId/summary` | Public | Average rating + distribution |
| POST | `/reviews` | Customer | Submit review |
| POST | `/reviews/:id/helpful` | Customer | Mark as helpful |
| GET | `/reviews/admin` | Admin | All reviews (pending/approved/rejected) |
| PATCH | `/reviews/admin/:id/status` | Admin | Approve or reject |
| DELETE | `/reviews/admin/:id` | Admin | Delete review |

### Users & Addresses

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | Customer | Own profile |
| PATCH | `/users/me` | Customer | Update profile |
| GET | `/users/me/addresses` | Customer | List addresses |
| POST | `/users/me/addresses` | Customer | Add address |
| PATCH | `/users/me/addresses/:id` | Customer | Update address |
| DELETE | `/users/me/addresses/:id` | Customer | Delete address |
| POST | `/users/sync` | Internal | Clerk webhook user sync |
| GET | `/users/admin/customers` | Admin | All customers with stats |

### Coupons

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/coupons/validate` | Optional | Validate code + calculate discount |
| GET | `/coupons/admin` | Admin | List all coupons |
| GET | `/coupons/admin/:id` | Admin | Single coupon + usage detail |
| POST | `/coupons/admin` | Admin | Create coupon |
| PATCH | `/coupons/admin/:id` | Admin | Update coupon |
| DELETE | `/coupons/admin/:id` | Admin | Soft-delete coupon |

### Homepage CMS

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/homepage` | Public | All active homepage data |
| GET | `/homepage/admin/sections` | Admin | All sections |
| PATCH | `/homepage/admin/sections/:key` | Admin | Update section |
| GET | `/homepage/admin/hero` | Admin | All hero slides |
| POST | `/homepage/admin/hero` | Admin | Create slide |
| PATCH | `/homepage/admin/hero/:id` | Admin | Update slide |
| DELETE | `/homepage/admin/hero/:id` | Admin | Delete slide |
| PATCH | `/homepage/admin/hero/reorder` | Admin | Batch reorder |
| GET | `/homepage/admin/featured` | Admin | Featured products |
| PUT | `/homepage/admin/featured` | Admin | Replace featured list |
| GET | `/homepage/admin/testimonials` | Admin | All testimonials |
| POST | `/homepage/admin/testimonials` | Admin | Create testimonial |
| PATCH | `/homepage/admin/testimonials/:id` | Admin | Update testimonial |
| DELETE | `/homepage/admin/testimonials/:id` | Admin | Delete testimonial |
| PATCH | `/homepage/admin/testimonials/reorder` | Admin | Batch reorder |

### Sizes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sizes/groups` | Public | All size groups with sizes |
| POST | `/sizes/admin/groups` | Admin | Create size group |
| PATCH | `/sizes/admin/groups/:id` | Admin | Rename group |
| DELETE | `/sizes/admin/groups/:id` | Admin | Delete group |
| POST | `/sizes/admin/groups/:groupId/sizes` | Admin | Add size |
| PATCH | `/sizes/admin/sizes/:id` | Admin | Update size |
| DELETE | `/sizes/admin/sizes/:id` | Admin | Delete size |

### Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/low-stock?threshold=` | Admin | Low stock items |
| POST | `/inventory/adjust` | Admin | Manual stock adjustment |
| GET | `/inventory/logs` | Admin | Inventory change logs |

### Admin — Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/analytics/overview` | Admin | MTD revenue, orders, customers |
| GET | `/admin/analytics/revenue?period=` | Admin | Revenue over time |
| GET | `/admin/analytics/top-products` | Admin | Best-sellers by revenue |
| GET | `/admin/analytics/orders-by-status` | Admin | Order status breakdown |
| GET | `/admin/analytics/recent-orders` | Admin | Latest 10 orders |

### Admin — Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/orders` | Admin | All orders (filters, pagination) |
| GET | `/admin/orders/:id` | Admin | Order detail |
| PATCH | `/admin/orders/:id/status` | Admin | Update order status |
| POST | `/admin/orders/:id/refund` | Admin | Issue Razorpay refund |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Server status |

---

## Authentication

### Public Endpoints
No authentication required. Examples: product listing, collection browsing, homepage data.

### Customer Endpoints
Require `Authorization: Bearer <clerk_token>` header. The token is verified against Clerk's JWKS endpoint. Available to any authenticated user.

### Admin Endpoints
Same `Authorization` header, but additionally require the Clerk user to have `publicMetadata: { "role": "admin" }`. Set this in Clerk Dashboard → Users → Edit → publicMetadata.

### Internal Webhooks
`POST /users/sync` uses `x-webhook-secret` header (matched against `INTERNAL_WEBHOOK_SECRET` env var) instead of JWT.

### Clerk User Sync Flow
1. User signs up via Clerk frontend
2. Clerk fires webhook to Next.js `/api/webhooks/clerk`
3. Next.js forwards to `POST /api/v1/users/sync` on this API
4. User is upserted into the `users` table

---

## Database

### Tables (21 total)
`users`, `addresses`, `collections`, `products`, `product_collections`, `product_images`, `product_variants`, `size_groups`, `sizes`, `product_size_stock`, `inventory_logs`, `coupons`, `coupon_usages`, `carts`, `cart_items`, `orders`, `order_items`, `order_status_history`, `payments`, `reviews`, `review_images`, `review_helpful_votes`, `wishlists`, `hero_slides`, `homepage_featured_products`, `testimonials`, `homepage_sections`

### Migration
```bash
npm run db:migrate
```

Runs `migrations/001_schema.sql` against the database specified in `DATABASE_URL`. The migration is **idempotent** — all `CREATE TABLE` statements use `IF NOT EXISTS`.

---

## Testing with Swagger UI

The most convenient way to test the API is through the Swagger UI at **http://localhost:3001/docs**.

1. Start the server with `npm run dev`
2. Open `http://localhost:3001/docs` in your browser
3. Click on any endpoint to expand it
4. For protected endpoints, click **Authorize** and paste your Clerk JWT token
5. Fill in parameters and click **Try it out!**

### Testing with curl

```bash
# Health check
curl http://localhost:3001/health

# List products
curl http://localhost:3001/api/v1/products

# Get product by slug
curl http://localhost:3001/api/v1/products/product-slug

# Authenticated request (replace TOKEN with Clerk JWT)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/v1/users/me

# Validate coupon
curl -X POST http://localhost:3001/api/v1/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"SAVE20","cartItems":[{"variantId":"...","productId":"...","quantity":1,"price":500}],"subtotal":500}'
```

---

## Error Handling

All errors return JSON with this shape:

```json
{
  "error": "Description of what went wrong"
}
```

| HTTP Status | Meaning |
|---|---|
| 400 | Bad request (validation, invalid coupon, etc.) |
| 401 | Missing or invalid auth token |
| 403 | Authenticated but not admin |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Deployment

### Railway

1. Push `apps/api` to GitHub
2. Create Railway project → connect repo → set root directory to `apps/api`
3. Add environment variables in Railway dashboard
4. Railway auto-deploys on push

### Database

1. Create project at [neon.tech](https://neon.tech)
2. Copy connection string to `DATABASE_URL` env var
3. Run migration: `npm run db:migrate`
4. Enable PgBouncer connection pooling in Neon dashboard

---

## Data Flow

### New Order Flow
```
Customer → POST /orders → Create order (status: pending)
        → POST /payments/create-order → Razorpay order
        → Razorpay checkout modal → Payment
        → POST /payments/verify → Verify HMAC → status: confirmed
        → Stock deducted, coupon usage recorded, cart cleared
```

### Homepage CMS Flow
```
Admin → PATCH /homepage/admin/hero/:id → Update slide
     → (Optionally) POST /api/revalidate → Revalidate Next.js ISR cache
```

### Review Flow
```
Customer → POST /reviews → status: pending
Admin    → PATCH /reviews/admin/:id/status → approved/rejected
          → Approved review appears on product page
```
