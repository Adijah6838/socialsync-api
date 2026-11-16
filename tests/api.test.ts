import { test, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/lib/prisma.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  // Clean up the database after tests
  await prisma.reply.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.tenant.deleteMany();
  await app.close();
});

test('Cross-Tenant Access is Blocked', async () => {
  // 1. Create Tenant A and Tenant B
  const resA = await app.inject({ method: 'POST', url: '/tenants', payload: { name: 'Tenant A' } });
  const tenantA = resA.json();
  
  const resB = await app.inject({ method: 'POST', url: '/tenants', payload: { name: 'Tenant B' } });
  const tenantB = resB.json();

  // 2. Tenant A creates a provider and syncs comments
  const provA = await app.inject({
    method: 'POST', url: '/providers', headers: { 'x-api-key': tenantA.apiKey }, payload: { name: 'twitter' }
  });
  const providerId = provA.json().id;

  await app.inject({
    method: 'POST', url: `/providers/${providerId}/sync`, headers: { 'x-api-key': tenantA.apiKey }, payload: {}
  });

  const commentsA = await app.inject({
    method: 'GET', url: '/comments', headers: { 'x-api-key': tenantA.apiKey }
  });
  const commentId = commentsA.json().data[0].id;

  // 3. Tenant B tries to reply to Tenant A's comment
  const hackRes = await app.inject({
    method: 'POST',
    url: `/comments/${commentId}/reply`,
    headers: { 'x-api-key': tenantB.apiKey },
    payload: { content: 'Hacked!', idempotencyKey: 'hack-123' }
  });

  // Expect 404 Not Found
  expect(hackRes.statusCode).toBe(404);
});

test('Reply Idempotency', async () => {
  const res = await app.inject({ method: 'POST', url: '/tenants', payload: { name: 'Idempotency Tenant' } });
  const tenant = res.json();
  const headers = { 'x-api-key': tenant.apiKey };

  const prov = await app.inject({ method: 'POST', url: '/providers', headers, payload: { name: 'twitter' } });
  const providerId = prov.json().id;

  await app.inject({ method: 'POST', url: `/providers/${providerId}/sync`, headers, payload: {} });
  const comments = await app.inject({ method: 'GET', url: '/comments', headers });
  const commentId = comments.json().data[0].id;

  const payload = { content: 'Valid Reply', idempotencyKey: 'unique-key-999' };

  // First Request
  const res1 = await app.inject({ method: 'POST', url: `/comments/${commentId}/reply`, headers, payload });
  expect(res1.statusCode).toBe(201);
  const reply1Id = res1.json().data.id;

  // Second Request (Same Key)
  const res2 = await app.inject({ method: 'POST', url: `/comments/${commentId}/reply`, headers, payload });
  expect(res2.statusCode).toBe(200); // 200 instead of 201
  const reply2Id = res2.json().data.id;

  // IDs must match!
  expect(reply1Id).toBe(reply2Id);
});
