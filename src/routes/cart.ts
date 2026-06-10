import { FastifyInstance } from 'fastify'
import { CartService } from '../services/cart.service.js'
import { verifyToken } from '@clerk/backend'

export default async function cartRoutes(app: FastifyInstance) {
  const cartService = new CartService(app.db)

  async function resolveUserIdFromRequest(request: any): Promise<string | undefined> {
    const authHeader = request.headers.authorization
    if (!authHeader) return undefined
    const [scheme, token] = authHeader.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined
    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      const { rows: [u] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [payload.sub])
      return u?.id
    } catch {
      return undefined
    }
  }

  app.get('/', {
    schema: {
      description: 'Get cart (by user auth or session_id query param)',
      tags: ['Cart'],
      querystring: {
        type: 'object',
        properties: { session_id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const userId = await resolveUserIdFromRequest(request)
    const { session_id } = request.query as any

    if (!userId && !session_id) {
      return reply.status(400).send({ error: 'Requires authentication or session_id' })
    }

    const cart = await cartService.getOrCreateCart(userId, session_id)
    return cart
  })

  app.post('/items', {
    schema: {
      description: 'Add item to cart',
      tags: ['Cart'],
      body: {
        type: 'object',
        required: ['variant_id', 'quantity'],
        properties: {
          variant_id: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          cart_id: { type: 'string' },
          session_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { variant_id, quantity, cart_id, session_id } = request.body as any
    const userId = await resolveUserIdFromRequest(request)

    let cart
    if (cart_id) {
      cart = await cartService.getCartWithItems(cart_id)
    } else {
      cart = await cartService.getOrCreateCart(userId, session_id)
    }
    if (!cart) return reply.status(404).send({ error: 'Cart not found' })

    const updated = await cartService.addItem(cart.id, variant_id, quantity)
    reply.status(201).send(updated)
  })

  app.patch('/items/:id', {
    schema: {
      description: 'Update cart item quantity',
      tags: ['Cart'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['quantity'],
        properties: { quantity: { type: 'integer', minimum: 0 } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { quantity } = request.body as any
    await cartService.updateItemQuantity(id, quantity)
    reply.status(200).send({ success: true })
  })

  app.delete('/items/:id', {
    schema: {
      description: 'Remove item from cart',
      tags: ['Cart'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await cartService.removeItem(id)
    reply.status(204).send()
  })

  app.post('/merge', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Merge guest cart into user cart on login',
      tags: ['Cart'],
      body: {
        type: 'object',
        required: ['session_id'],
        properties: { session_id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { session_id } = request.body as any
    const clerkId = request.userId
    if (!clerkId) return reply.status(401).send({ error: 'Unauthorized' })

    const { rows: [user] } = await app.db.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])
    const userId = user?.id

    if (userId) await cartService.mergeGuestCart(session_id, userId)
    const cart = await cartService.getOrCreateCart(userId, session_id)
    return cart
  })
}
