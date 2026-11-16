import Fastify, { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import authPlugin from './plugins/auth.js';
import tenantRoutes from './routes/tenant.js';
import commentRoutes from './routes/comments.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(swagger, {
    openapi: {
      info: { title: 'SocialSync API', version: '1.0.0' },
      servers: [{ url: 'http://localhost:3000' }],
      components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
      security: [{ apiKey: [] }],
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: error.errors });
    }
    reply.send(error);
  });

  await app.register(tenantRoutes);
  await app.register(commentRoutes);

  return app;
}
