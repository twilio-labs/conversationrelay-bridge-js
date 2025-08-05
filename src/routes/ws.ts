import { FastifyInstance, FastifyRequest } from "fastify";
import {
  ActiveSessions,
  ConversationRelaySession,
  SessionIdKey,
} from "../session.js";
import WebSocket from "ws";

export default async function wsRoute(fastify: FastifyInstance) {
  fastify.get(
    "/ws",
    { websocket: true },
    (connection: WebSocket, req: FastifyRequest) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const crSessionFactory = req.diScope.resolve("crSessionFactory") as any;
      const sessions = req.diScope.resolve<ActiveSessions>("activeSessions");
      const sessionIdKey = req.diScope.resolve<SessionIdKey>("sessionIdKey");

      const session = crSessionFactory({
        connection,
        requestId: req.id,
        logger: req.log,
      }) as ConversationRelaySession;

      session.start(async (setup) => {
        if (sessionIdKey === "CallSid") {
          sessions.set(`${setup.callSid}`, session);
        } else if (sessionIdKey === "SessionId") {
          sessions.set(`${setup.sessionId}`, session);
        } else {
          sessions.set(`${setup.from}`, session);
        }
      });
      connection.on("close", () => session.close());
    },
  );
}
