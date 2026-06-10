# Adorrn Herbal — Backend API

REST API for the Adorrn Herbal e-commerce platform. Built with **Fastify**, backed by **PostgreSQL**, and integrated with **Clerk** (auth), **Cloudinary** (media), and **Razorpay** (payments).

---

## Table of Contents

1. [Quick Start — Local Dev](#1-quick-start--local-dev)
2. [Files You Need to Change](#2-files-you-need-to-change)
3. [Step-by-Step: Get Your API Keys](#3-step-by-step-get-your-api-keys)
4. [Environment Variables](#4-environment-variables)
5. [Deploy Online (Railway)](#5-deploy-online-railway)
6. [Deploy Online (Any Host)](#6-deploy-online-any-host)
7. [Getting a Dev Auth Token](#7-getting-a-dev-auth-token)
8. [Project Structure](#8-project-structure)
9. [API Endpoints](#9-api-endpoints)
10. [Database](#10-database)
11. [Testing](#11-testing)
12. [Error Handling](#12-error-handling)
13. [Data Flows](#13-data-flows)

---

## 1. Quick Start — Local Dev

### Option A: Docker (recommended)

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
npm install

# 3. Create env file and fill in keys (see §3)
cp .env.example .env

# 4. Create database tables
npm run db:migrate

# 5. Seed sample products, collections, sizes, etc.
npm run db:seed

# 6. Start the dev server
npm run dev
```

Server starts on **http://localhost:3001**.

### Option B: Existing Postgres

```bash
npm install
cp .env.example .env
# Edit DATABASE_URL in .env to point to your Postgres
npm run db:migrate
npm run db:seed
npm run dev
```

### Useful URLs

| URL | What it is |
|---|---|
| `http://localhost:3001/health` | Health check |
| `http://localhost:3001/docs` | Swagger UI (interactive API explorer) |
| `http://localhost:3001/api/v1/products` | Example public endpoint |

---

## 2. Files You Need to Change

**Only one file must be edited for deployment:** `.env` (or set environment variables in your hosting dashboard).

| File | Do you need to change it? | Why |
|---|---|---|
| `.env` | **Yes** — fill in your API keys | Without keys, Clerk auth, Cloudinary uploads, and Razorpay payments won't work |
| `.env.example` | No — it's just a template | Keep as-is for reference |
| `src/server.ts` | Only if you need a different port or custom CORS | Default port is 3001; CORS allows any origin in dev |
| `migrations/001_schema.sql` | Only if you want different table structure | Already has all 22 tables defined |
| `src/seed.ts` | Only if you want different sample data | Seeds 10 herbal products, 5 collections, sizes, testimonials, hero slides |
| `docker-compose.yml` | No — it runs PostgreSQL locally | Defaults are fine |
| Everything else | No | All routes, services, and plugins work as-is |

---

## 3. Step-by-Step: Get Your API Keys

You need four external services. All have **free tiers** sufficient for development and low-traffic production.

### 3.1 PostgreSQL Database

**Option A — Neon (recommended, free):**
1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a project → copy the connection string (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require`)
3. This is your `DATABASE_URL`

**Option B — Railway Postgres (free tier):**
1. Create a Railway account → start a new project → add a PostgreSQL plugin
2. Copy the `DATABASE_URL` from the plugin's "Connect" tab

**Option C — Any Postgres:**
Use any Postgres 14+ provider (AWS RDS, Supabase, Aiven, etc.)

### 3.2 Clerk (Authentication)

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and sign up
2. Create a new application → name it (e.g. "Adorrn Herbal")
3. Choose email/password or social sign-in methods
4. Click "Create application"
5. In the API Keys page, you'll see:
   - **Publishable Key** (`pk_test_...`) → `CLERK_PUBLISHABLE_KEY`
   - **Secret Key** (`sk_test_...`) → `CLERK_SECRET_KEY`
6. To set the admin role for your user:
   - Go to Users → click your user → scroll to "Public metadata"
   - Add: `{"role":"admin"}`
   - Save

> **Important:** Only users with `{"role":"admin"}` in their Clerk publicMetadata can access admin endpoints.

### 3.3 Cloudinary (Image Hosting)

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (free tier: 25 GB storage)
2. After signup, go to Dashboard → you'll see:
   - **Cloud name** (e.g. `dh9abcxyz`) → `CLOUDINARY_CLOUD_NAME`
   - **API Key** (e.g. `123456789012345`) → `CLOUDINARY_API_KEY`
   - **API Secret** (e.g. `abc123def456`) → `CLOUDINARY_API_SECRET`

### 3.4 Razorpay (Indian Payment Gateway)

1. Go to [razorpay.com](https://razorpay.com) and sign up
2. Go to Settings → API Keys → Generate Key
3. You'll get:
   - **Key ID** (`rzp_test_...`) → `RAZORPAY_KEY_ID`
   - **Key Secret** (`...`) → `RAZORPAY_KEY_SECRET`
4. To set up webhooks (for payment status updates):
   - Go to Settings → Webhooks → Add Webhook
   - URL: `https://your-domain.com/api/v1/payments/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Copy the **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`

---

## 4. Environment Variables

| Variable | Required | Where to get it | Example value |
|---|---|---|---|
| `DATABASE_URL` | Yes | Neon / Railway / any Postgres provider | `postgresql://user:pass@host:5432/db` |
| `CLERK_SECRET_KEY` | Yes | Clerk Dashboard → API Keys | `sk_test_abc123...` |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk Dashboard → API Keys | `pk_test_abc123...` |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary Dashboard | `dh9abcxyz` |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary Dashboard | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary Dashboard | `abc123def456` |
| `RAZORPAY_KEY_ID` | Yes | Razorpay Settings → API Keys | `rzp_test_abc123` |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay Settings → API Keys | `abc123def456` |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay Settings → Webhooks | `abc123def456` |
| `PORT` | No | — | `3001` (default) |
| `NODE_ENV` | No | — | `development` or `production` |
| `FRONTEND_URL` | No | Your frontend domain | `https://your-store.vercel.app` |
| `INTERNAL_WEBHOOK_SECRET` | No | Any random string | `my-secret-123` |
| `REVALIDATION_TOKEN` | No | Any random string | `reval-secret-456` |

Copy `.env.example` to `.env` and fill in your values. The `.env` file is already git-ignored.

---

## 5. Deploy Online (Railway)

Railway is the recommended hosting platform for this backend.

### Step 1: Push to GitHub

```bash
git init
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

> **Important:** The code lives in `apps/api/`. If your root is already a monorepo, set Railway's root directory to `apps/api`.

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Set **Root Directory** to `apps/api` (if applicable)
5. Railway auto-detects the `npm start` command

### Step 3: Add Environment Variables

In Railway dashboard → your project → Variables:
```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

> **TIP:** You can also add a Railway PostgreSQL plugin from **New → Database → PostgreSQL**. It auto-injects a `DATABASE_URL` variable.

### Step 4: Run Migrations & Seed

After the first deploy, open Railway's **Shell** tab and run:

```bash
npm run db:migrate
npm run db:seed
```

Or run them locally against your production database by temporarily setting `DATABASE_URL` to your Railway Postgres URL.

### Step 5: Done

Your API is live at `https://your-project.up.railway.app`. Visit `https://your-project.up.railway.app/health` to confirm.

---

## 6. Deploy Online (Any Host)

You can deploy anywhere that runs Node.js (Fly.io, Render, AWS ECS, DigitalOcean App Platform, Koyeb, etc.).

### Build & Start

The production build compiles TypeScript to JavaScript:

```bash
npm run build    # outputs to dist/
npm start        # runs dist/server.js
```

### Deployment Checklist

- [ ] Set all environment variables in your hosting dashboard
- [ ] Run `npm run db:migrate` as a one-time setup step
- [ ] Run `npm run db:seed` to populate initial data
- [ ] Set `NODE_ENV=production`
- [ ] Ensure your PostgreSQL database is accessible from the hosting provider (allowlist IPs if needed)
- [ ] Point your frontend's `VITE_API_BASE_URL` to the deployed API URL

---

## 7. Getting a Dev Auth Token

Clerk JWT tokens expire after 60 seconds. For API testing, use the dev token endpoint:

```bash
curl -X POST http://localhost:3001/api/v1/dev/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_abc123"}' \
  | jq -r '.token'
```

Replace `user_abc123` with your Clerk user ID (found in Clerk Dashboard → Users → click your user → copy the ID).

The returned token can be used immediately with the `Authorization: Bearer <token>` header. Token is valid for 60 seconds — generate a new one for each test session.

---

## 8. Project Structure

```
apps/api/
├── migrations/
│   └── 001_schema.sql         # Full database schema (22 tables + indexes)
├── src/
│   ├── server.ts               # Fastify entry point — register plugins + routes
│   ├── types.ts                # TypeScript type declarations for Fastify
│   ├── migrate.ts              # Schema migration runner
│   ├── seed.ts                 # Seeds 10 products, collections, sizes, etc.
│   ├── plugins/
│   │   ├── auth.ts             # Clerk JWT verification + admin role check
│   │   ├── db.ts               # PostgreSQL connection pool (pg)
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
│   │   ├── cart.ts             # Cart & cart items (guest + auth)
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
│   │       ├── dashboard.ts    # Order management, refunds
│   │       └── frontend.ts     # Dashboard, products, customers, reviews, coupons, homepage, settings, inventory
│   └── webhooks/
│       └── razorpay.ts         # Razorpay webhook receiver
├── .env.example                # Environment template
├── docker-compose.yml          # PostgreSQL 16 for local dev
├── package.json
└── tsconfig.json
```

---

## 9. API Endpoints

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

### Admin — Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/dashboard/stats` | Admin | MTD revenue, orders, new customers, avg order value |
| GET | `/admin/dashboard/revenue?period=` | Admin | Revenue over time (daily/weekly/monthly) |
| GET | `/admin/dashboard/top-products` | Admin | Top 10 products by revenue |
| GET | `/admin/dashboard/recent-orders` | Admin | Latest 10 orders |
| GET | `/admin/dashboard/order-status` | Admin | Order status distribution |

### Admin — Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/orders` | Admin | All orders (filters: `status`, `search`, `page`, `limit`) |
| GET | `/admin/orders/:id` | Admin | Order detail with items, history, payment |
| PATCH | `/admin/orders/:id/status` | Admin | Update order status |
| POST | `/admin/orders/:id/refund` | Admin | Issue Razorpay refund |

### Admin — Products

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/products` | Admin | List products (`page`, `limit`, `search`, `is_active`) |
| GET | `/admin/products/:id` | Admin | Single product with variants, images, collections |
| POST | `/admin/products` | Admin | Create product with optional variants + collections |
| PUT | `/admin/products/:id` | Admin | Update product, variants, collections |
| DELETE | `/admin/products/:id` | Admin | Soft-delete (sets `is_active = false`) |

### Admin — Customers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/customers` | Admin | List customers with order count + total spent (`page`, `limit`, `search`) |
| GET | `/admin/customers/:id` | Admin | Customer detail with recent orders |

### Admin — Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/reviews` | Admin | All reviews (`status`, `page`, `limit`) |
| PATCH | `/admin/reviews/:id/status` | Admin | Approve or reject review |
| DELETE | `/admin/reviews/:id` | Admin | Delete review |

### Admin — Coupons

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/coupons` | Admin | List all coupons (`page`, `limit`) |
| GET | `/admin/coupons/:id` | Admin | Single coupon detail |
| POST | `/admin/coupons` | Admin | Create coupon |
| PUT | `/admin/coupons/:id` | Admin | Update coupon |
| DELETE | `/admin/coupons/:id` | Admin | Soft-delete coupon |
| GET | `/admin/coupons/:id/usage` | Admin | Coupon usage history with customer info |

### Admin — Homepage

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/homepage` | Admin | All CMS data (hero slides, featured products, testimonials, sections) |
| PUT | `/admin/homepage` | Admin | Update homepage CMS data |

### Admin — Settings

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/settings` | Admin | All store settings |
| PUT | `/admin/settings` | Admin | Upsert store settings |

### Admin — Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/inventory` | Admin | Stock listing (`page`, `limit`, `low_stock`, `threshold`) |
| PATCH | `/admin/inventory/:id` | Admin | Update stock quantity with log entry |

### Developer Tools

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Server status (`{"status":"ok","timestamp":"..."}`) |
| POST | `/dev/token` | None | Generate a 60-second Clerk JWT for testing (body: `{"userId":"user_..."}`) |

---

## 10. Database

### Tables (22 total)

`users`, `addresses`, `collections`, `products`, `product_collections`, `product_images`, `product_variants`, `size_groups`, `sizes`, `product_size_stock`, `inventory_logs`, `coupons`, `coupon_usages`, `carts`, `cart_items`, `orders`, `order_items`, `order_status_history`, `payments`, `reviews`, `review_images`, `review_helpful_votes`, `wishlists`, `hero_slides`, `homepage_featured_products`, `testimonials`, `homepage_sections`, `store_settings`

### Migration

```bash
npm run db:migrate
```

Runs `migrations/001_schema.sql` against the database specified in `DATABASE_URL`. The migration is **idempotent** — all `CREATE TABLE` statements use `IF NOT EXISTS`. Safe to run multiple times.

### Seed Data

```bash
npm run db:seed
```

Populates:
- **10 herbal products** (hair oils, skin serums, face washes, etc.) with rich HTML descriptions and tags
- **5 collections** (Hair Care, Skin Care, Body Care, Gift Sets, Essentials)
- **6 size groups** with multiple sizes each (e.g., 50ml, 100ml, 200ml)
- **Cross-product size-stock entries** linking every variant to every size
- **3 hero slides** (rotation banners for the storefront)
- **3 testimonials** (sample customer quotes)

Run only once initially. Re-running will skip existing rows (uses `ON CONFLICT DO NOTHING`).

---

## 11. Testing

### Swagger UI

The most convenient way to test the API is through the Swagger UI at **http://localhost:3001/docs**.

1. Start the server
2. Open `http://localhost:3001/docs`
3. Click on any endpoint to expand it
4. For protected endpoints, click **Authorize** and paste your Clerk JWT token
5. Fill in parameters and click **Try it out!**

### curl examples

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

### TypeScript checks

```bash
npm run typecheck
```

---

## 12. Error Handling

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

## 13. Data Flows

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
Admin → PUT /admin/homepage → Update slides/featured/testimonials
     → Frontend re-fetches GET /homepage → Updated storefront
```

### Review Flow

```
Customer → POST /reviews → status: pending
Admin    → PATCH /admin/reviews/:id/status → approved/rejected
          → Approved review appears on product page
```

### Authentication Flow

```
Frontend → Clerk SDK → User signs in → Clerk issues JWT (60s expiry)
        → API call with Authorization: Bearer <jwt>
        → Server verifies JWT via Clerk's JWKS endpoint
        → Server fetches user role from Clerk API publicMetadata
        → If admin endpoint: checks role === 'admin'
```

### User Sync Flow

```
1. User signs up via Clerk frontend
2. Clerk fires webhook to Next.js /api/webhooks/clerk
3. Next.js forwards to POST /api/v1/users/sync on this API
4. User is upserted into the users table
```
