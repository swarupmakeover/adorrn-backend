import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import authPlugin from './plugins/auth.js'
import dbPlugin from './plugins/db.js'
import cloudinaryPlugin from './plugins/cloudinary.js'
import productRoutes from './routes/products.js'
import collectionRoutes from './routes/collections.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import paymentRoutes from './routes/payments.js'
import reviewRoutes from './routes/reviews.js'
import userRoutes from './routes/users.js'
import couponRoutes from './routes/coupons.js'
import inventoryRoutes from './routes/inventory.js'
import homepageRoutes from './routes/homepage.js'
import sizeRoutes from './routes/sizes.js'
import adminAnalyticsRoutes from './routes/admin/analytics.js'
import adminDashboardRoutes from './routes/admin/dashboard.js'
import adminFrontendRoutes from './routes/admin/frontend.js'
import razorpayWebhookRoutes from './webhooks/razorpay.js'
import devRoutes from './routes/dev.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true,
  credentials: true,
})
await app.register(multipart)

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Adorrn Herbal - E-Commerce API',
      description: 'REST API for the Adorrn Herbal e-commerce platform. All admin endpoints require Authorization: Bearer <clerk_token> header with admin role.',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 3001}`, description: 'Development' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
})

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
})

await app.register(dbPlugin)
await app.register(cloudinaryPlugin)
await app.register(authPlugin)

await app.register(productRoutes, { prefix: '/api/v1/products' })
await app.register(collectionRoutes, { prefix: '/api/v1/collections' })
await app.register(cartRoutes, { prefix: '/api/v1/cart' })
await app.register(orderRoutes, { prefix: '/api/v1/orders' })
await app.register(paymentRoutes, { prefix: '/api/v1/payments' })
await app.register(reviewRoutes, { prefix: '/api/v1/reviews' })
await app.register(userRoutes, { prefix: '/api/v1/users' })
await app.register(couponRoutes, { prefix: '/api/v1/coupons' })
await app.register(inventoryRoutes, { prefix: '/api/v1/inventory' })
await app.register(homepageRoutes, { prefix: '/api/v1/homepage' })
await app.register(sizeRoutes, { prefix: '/api/v1/sizes' })
await app.register(adminAnalyticsRoutes, { prefix: '/api/v1/admin' })
await app.register(adminDashboardRoutes, { prefix: '/api/v1/admin' })
await app.register(adminFrontendRoutes, { prefix: '/api/v1/admin' })
await app.register(razorpayWebhookRoutes, { prefix: '/api/v1/payments' })
await app.register(devRoutes, { prefix: '/api/v1/dev' })

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
