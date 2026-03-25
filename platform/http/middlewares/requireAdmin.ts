import { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user?.roles.includes('org_admin')) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }
}
