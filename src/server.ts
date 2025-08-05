import { fastify, RouteHandler } from "fastify";
import { diContainer, fastifyAwilixPlugin } from "@fastify/awilix";
import { asValue } from "awilix";
import fastifyWebsocket from "@fastify/websocket";
import formbody from "@fastify/formbody";
import fastifyEnv, { FastifyEnvOptions } from "@fastify/env";
import * as routes from "./routes/index.js";
import * as handlers from "./handlers/index.js";
import * as hooks from "./hooks/index.js";
import {
  ConversationRelaySession,
  ConversationRelaySessionArgs,
  SessionIdKey,
} from "./session.js";

type ServerConfiguration = {
  port: number;
  envSchema?: FastifyEnvOptions["schema"];
  twiml: RouteHandler;
  messages?: RouteHandler;
  sessionId?: SessionIdKey;
  crSession: typeof ConversationRelaySession;
};

export async function createFastify() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  });

  await server.register(fastifyAwilixPlugin, {
    strictBooleanEnforced: true,
    disposeOnClose: true,
    disposeOnResponse: true,
  });
  await server.register(formbody);
  await server.register(fastifyWebsocket);
  await server.register(hooks.registerSessionHooks);
  await server.register(routes.health);
  await server.register(routes.ws);

  return server;
}

const createServer = async (config: ServerConfiguration) => {
  const server = await createFastify();

  if (config.envSchema) {
    await server.register(fastifyEnv, {
      schema: config.envSchema,
      dotenv: true,
    });
  }

  server.register(handlers.twiml(config.twiml));
  if (config.messages) {
    server.register(handlers.messages(config.messages));
  }

  diContainer.register({
    logger: asValue(server.log),
    sessionIdKey: asValue(config.sessionId ?? "From"),
    GLOBAL_CONFIG: asValue(config),
    crSessionFactory: asValue<
      (args: ConversationRelaySessionArgs) => ConversationRelaySession
    >((args) => new config.crSession(args)),
    activeSessions: asValue(new Map<string, ConversationRelaySession>()),
  });

  return server;
};

export { createServer, diContainer };
