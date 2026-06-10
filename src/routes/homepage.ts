import { FastifyInstance } from 'fastify'
import { HomepageService } from '../services/homepage.service.js'

export default async function homepageRoutes(app: FastifyInstance) {
  const homepageService = new HomepageService(app.db)

  app.get('/', {
    schema: {
      description: 'Get all active homepage data (public)',
      tags: ['Homepage CMS'],
    },
  }, async () => {
    return homepageService.getFullHomepage()
  })

  app.get('/admin/sections', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get all homepage sections (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return homepageService.getSections()
  })

  app.patch('/admin/sections/:key', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a homepage section (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
    },
  }, async (request, reply) => {
    const { key } = request.params as any
    const section = await homepageService.updateSection(key, request.body as any)
    return section
  })

  app.get('/admin/hero', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get all hero slides (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return homepageService.getHeroSlides()
  })

  app.post('/admin/hero', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a hero slide (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['desktop_image_cloudinary_id', 'desktop_image_url'],
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          cta_label: { type: 'string' },
          cta_url: { type: 'string' },
          desktop_image_cloudinary_id: { type: 'string' },
          desktop_image_url: { type: 'string' },
          mobile_image_cloudinary_id: { type: 'string' },
          mobile_image_url: { type: 'string' },
          text_color: { type: 'string' },
          overlay_opacity: { type: 'number' },
          position: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const slide = await homepageService.createHeroSlide(request.body as any)
    reply.status(201).send(slide)
  })

  app.patch('/admin/hero/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a hero slide (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const slide = await homepageService.updateHeroSlide(id, request.body as any)
    return slide
  })

  app.delete('/admin/hero/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete a hero slide (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await homepageService.deleteHeroSlide(id)
    reply.status(204).send()
  })

  app.patch('/admin/hero/reorder', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Reorder hero slides (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    await homepageService.reorderHeroSlides(request.body as { id: string; position: number }[])
    reply.status(200).send({ success: true })
  })

  app.get('/admin/featured', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get featured products (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return homepageService.getFeaturedProducts()
  })

  app.put('/admin/featured', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Replace all featured products (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    await homepageService.setFeaturedProducts(request.body as any)
    reply.status(200).send({ success: true })
  })

  app.get('/admin/testimonials', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Get all testimonials (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    return homepageService.getTestimonials()
  })

  app.post('/admin/testimonials', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Create a testimonial (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['author_name', 'body'],
        properties: {
          author_name: { type: 'string' },
          author_title: { type: 'string' },
          avatar_cloudinary_id: { type: 'string' },
          avatar_url: { type: 'string' },
          body: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          source: { type: 'string' },
          source_url: { type: 'string' },
          position: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const testimonial = await homepageService.createTestimonial(request.body as any)
    reply.status(201).send(testimonial)
  })

  app.patch('/admin/testimonials/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Update a testimonial (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    const testimonial = await homepageService.updateTestimonial(id, request.body as any)
    return testimonial
  })

  app.delete('/admin/testimonials/:id', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Delete a testimonial (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any
    await homepageService.deleteTestimonial(id)
    reply.status(204).send()
  })

  app.patch('/admin/testimonials/reorder', {
    preHandler: [app.requireAdmin],
    schema: {
      description: 'Reorder testimonials (admin)',
      tags: ['Homepage CMS - Admin'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    await homepageService.reorderTestimonials(request.body as { id: string; position: number }[])
    reply.status(200).send({ success: true })
  })
}
