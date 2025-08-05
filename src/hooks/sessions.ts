import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest } from "fastify";
import { asFunction } from "awilix";
import { ActiveSessions, SessionIdKey } from "../session.js";

type Args = {
  activeSessions: ActiveSessions;
};

const registerSessionHooks = async (fastify: FastifyInstance) => {
  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    const sessionIdKey = req.diScope.resolve<SessionIdKey>("sessionIdKey");

    req.diScope.register({
      getActiveSession: asFunction(({ activeSessions }: Args) => {
        return async (sessionId?: string) => {
          if (sessionId) {
            return activeSessions.get(sessionId);
          }

          const body = req.body as Record<string, string>;
          if (sessionIdKey === "CallSid") {
            const callSid =
              (body?.CallSid || body?.Sid || body?.callSid || body?.sid) ?? "";
            if (callSid.startsWith("CA")) {
              return activeSessions.get(callSid);
            }
          }
          if (sessionIdKey === "SessionId") {
            const sessionId =
              (body?.sessionId || body?.SessionId || body.id) ?? "";
            if (sessionId.startsWith("VX")) {
              return activeSessions.get(sessionId);
            }
          }

          const from = (body?.From || body?.from) ?? "";
          if (from) {
            return activeSessions.get(from);
          }

          return null;
        };
      }).scoped(),
    });
  });
};

export default fp(registerSessionHooks);
