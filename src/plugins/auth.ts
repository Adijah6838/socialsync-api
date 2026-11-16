import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: { id: string; name: string };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('tenant', null);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if ((request.url === '/tenants' && request.method === 'POST') || request.url.startsWith('/docs') || request.url.startsWith('/documentation')) {
      return;
    }

    const apiKey = request.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      return reply.status(401).send({ error: 'Missing x-api-key header' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { apiKey } });
    if (!tenant) {
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    request.tenant = { id: tenant.id, name: tenant.name };
  });
};

export default fp(authPlugin);
