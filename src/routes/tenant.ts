import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/tenants', async (request, reply) => {
    const schema = z.object({ name: z.string().min(2) });
    const { name } = schema.parse(request.body);
    const apiKey = `sk_${randomBytes(16).toString('hex')}`;

    const tenant = await prisma.tenant.create({ data: { name, apiKey } });
    return reply.status(201).send(tenant);
  });
};

export default tenantRoutes;
