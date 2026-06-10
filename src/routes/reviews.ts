import { FastifyInstance } from 'fastify'
import { ReviewService } from '../services/review.service.js'

export default async function reviewRoutes(app: FastifyInstance) {
  const reviewService = new ReviewService(app.db)

  app.get('/product/:productId', {
    schema: {
      description: 'Get approved reviews for a product (paginated)',
      tags: ['Reviews'],
      params: {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
      },
    },
  }, async (request, reply) => {
    const { productId } = request.params as any
    const { page = 1, limit = 20 } = request.query as any
    const result = await reviewService.getByProduct(productId, page, limit)
    return result
  })

  app.get('/product/:productId/summary', {
    schema: {
      description: 'Get rating summary for a product',
      tags: ['Reviews'],
      params: {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
      },
    },
  }, async (request, reply) => {
    const { productId } = request.params as any
    const summary = await reviewService.getSummary(productId)
    return summary
  })

  app.post('/', {
    schema: {
      description: 'Submit a review (customer)',
      tags: ['Reviews'],
      body: {
        type: 'object',
        required: ['product_id', 'rating'],
        properties: {
          product_id: { type: 'string' },
          order_item_id: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string' },
          body: { type: 'string' },
          image_urls: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      const review = await reviewService.create({ ...request.body as any, user_id: userId })
      reply.status(201).send(review)
    } catch (err: any) {
      reply.status(400).send({ error: err.message })
    }
  })

  app.post('/:id/helpful', {
    schema: {
      description: 'Mark a review as helpful',
      tags: ['Reviews'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      await reviewService.markHelpful((request.params as any).id, userId)
      return { success: true }
    } catch (err: any) {
      reply.status(400).send({ error: err.message })
    }
  })

  app.get('/admin', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'List all reviews with moderation status (admin)',
      tags: ['Reviews - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { status, page, limit } = request.query as any
    const result = await reviewService.listAll({ status, page, limit })
    return result
  })

  app.patch('/admin/:id/status', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Approve or reject a review (admin)',
      tags: ['Reviews - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['approved', 'rejected'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const { status } = request.body as any
    const review = await reviewService.updateStatus(id, status)
    return review
  })

  app.delete('/admin/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete a review (admin)',
      tags: ['Reviews - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await reviewService.delete(id)
    reply.status(204).send()
  })
}
