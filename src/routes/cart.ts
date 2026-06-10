import { FastifyInstance } from 'fastify'
import { CartService } from '../services/cart.service.js'

export default async function cartRoutes(app: FastifyInstance) {
  const cartService = new CartService(app.db)

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
    const userId = request.userId
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
    const userId = request.userId

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
    const userId = request.userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    await cartService.mergeGuestCart(session_id, userId)
    const cart = await cartService.getOrCreateCart(userId)
    return cart
  })
}
