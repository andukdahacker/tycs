/**
 * Auth Plugin — Registration Order: Position 1 (registered FIRST)
 *
 * Uses request decorator pattern:
 *   fastify.decorateRequest('uid', '')
 *   declare module 'fastify' { interface FastifyRequest { uid: string } }
 *
 * Global onRequest hook verifies Firebase ID tokens.
 * Downstream plugins read request.uid for authenticated user identification.
 *
 * Actual implementation in Story 2.1.
 */

export {}
