import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { getProviderAdapter } from '../adapters/provider-adapter.js';

const commentRoutes: FastifyPluginAsync = async (fastify) => {
  
  fastify.post('/providers', async (request, reply) => {
    const schema = z.object({ name: z.string(), config: z.record(z.any()).default({}) });
    const { name, config } = schema.parse(request.body);
    const provider = await prisma.provider.create({
      data: { tenantId: request.tenant!.id, name, config }
    });
    return reply.status(201).send(provider);
  });

  fastify.post('/providers/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const provider = await prisma.provider.findFirst({
      where: { id, tenantId: request.tenant!.id }
    });
    if (!provider) return reply.status(404).send({ error: 'Provider not found' });

    const adapter = getProviderAdapter(provider.name, provider.config);
    const fetchedComments = await adapter.fetchComments();
    let savedCount = 0;

    for (const c of fetchedComments) {
      await prisma.comment.upsert({
        where: { tenantId_providerId_externalId: { tenantId: request.tenant!.id, providerId: provider.id, externalId: c.externalId } },
        update: { content: c.content, author: c.author },
        create: { tenantId: request.tenant!.id, providerId: provider.id, externalId: c.externalId, content: c.content, author: c.author }
      });
      savedCount++;
    }
    return { message: `Synced ${savedCount} comments from ${provider.name}` };
  });

  fastify.get('/comments', async (request, reply) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(100).default(10),
      cursor: z.string().optional(),
      q: z.string().optional()
    });
    const { limit, cursor, q } = schema.parse(request.query);

    const comments = await prisma.comment.findMany({
      where: { tenantId: request.tenant!.id, content: q ? { contains: q } : undefined },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' }
    });

    const nextCursor = comments.length === limit ? comments[comments.length - 1].id : null;
    return { data: comments, meta: { nextCursor, hasMore: nextCursor !== null } };
  });

  // --- NEW: Reply to Comment with Idempotency ---
  fastify.post('/comments/:id/reply', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      content: z.string().min(1),
      idempotencyKey: z.string().min(1)
    });
    const { content, idempotencyKey } = schema.parse(request.body);

    // 1. Check if this reply was already processed (Idempotency)
    const existingReply = await prisma.reply.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: request.tenant!.id,
          idempotencyKey
        }
      }
    });

    if (existingReply) {
      // Return 200 OK instead of 201 Created
      return reply.status(200).send({ message: 'Reply already processed', data: existingReply });
    }

    // 2. Enforce Tenant Isolation
    const comment = await prisma.comment.findFirst({
      where: { id, tenantId: request.tenant!.id },
      include: { provider: true }
    });

    if (!comment) {
      return reply.status(404).send({ error: 'Comment not found' });
    }

    // 3. Use Provider Adapter to send the reply
    const adapter = getProviderAdapter(comment.provider.name, comment.provider.config);
    const result = await adapter.postReply(comment.externalId, content);

    // 4. Save the reply
    const newReply = await prisma.reply.create({
      data: {
        tenantId: request.tenant!.id,
        commentId: comment.id,
        content,
        idempotencyKey,
        status: result.success ? 'SENT' : 'FAILED'
      }
    });

    return reply.status(201).send({ message: 'Reply sent', data: newReply });
  });
};

export default commentRoutes;
