import type { FastifyRequest, FastifyReply } from 'fastify';

// Auth disabled — all requests pass through
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // no-op
}
