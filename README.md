# SocialSync — Multi-Tenant Comments API

A robust, highly-available API for retrieving and managing comments across simulated social platforms (Twitter, Facebook). Built with TypeScript, Fastify, Prisma, and SQLite.

## Architecture Features
- **Multi-Tenant Isolation**: Enforces strict tenant isolation at the database query level using API keys (`x-api-key`). Tenants can never read or modify another tenant's data.
- **Provider Adapter Pattern**: Easily extensible interface (`IProviderAdapter`) to integrate new social networks without changing the core API.
- **Idempotent Replies**: Uses an `idempotencyKey` provided by the client to guarantee duplicate replies are never sent to the provider.
- **Keyset Pagination**: Highly performant cursor-based pagination for retrieving comments (using `cursor` and `limit`).
- **OpenAPI Documentation**: Auto-generated Swagger UI available at `/docs`.

## Quick Start
1. Install dependencies:
   `npm install`
2. Setup the database:
   `npx prisma db push`
3. Run the development server:
   `npm run dev`
4. Open API docs:
   `http://localhost:3000/docs`

## Running Tests
We use Vitest and Fastify's `inject` for lightning-fast integration tests.
```bash
npx vitest run