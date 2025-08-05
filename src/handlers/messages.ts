import { RouteHandler, FastifyInstance } from "fastify";

export default function messagesHandler(handler: RouteHandler) {
  return async function messagesRoute(fastify: FastifyInstance) {
    fastify.post("/messages", handler);
  };
}
