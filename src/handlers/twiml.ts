import { RouteHandler, FastifyInstance } from "fastify";

export default function twimlHandler(handler: RouteHandler) {
  return async function twimlRoutes(fastify: FastifyInstance) {
    fastify.get("/twiml", handler);
    fastify.post("/twiml", handler);
  };
}
