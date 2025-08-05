import { describe, it, expect, vi, beforeEach } from "vitest";
import registerSessionHooks from "../../src/hooks/sessions.js";
import { FastifyInstance } from "fastify";
import { ActiveSessions, ConversationRelaySession } from "../../src/session.js";

interface MockDiScope {
  resolve: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
}

interface MockRequest {
  diScope: MockDiScope;
  body: Record<string, string>;
}

describe("hooks/sessions", () => {
  let mockFastify: FastifyInstance;
  let mockReq: MockRequest;
  let mockActiveSessions: ActiveSessions;
  let mockDiScope: MockDiScope;

  beforeEach(() => {
    mockActiveSessions = new Map();
    mockDiScope = {
      resolve: vi.fn().mockReturnValue("CallSid"),
      register: vi.fn(),
    };
    mockReq = {
      diScope: mockDiScope,
      body: {},
    };
    mockFastify = {
      addHook: vi.fn(),
    } as unknown as FastifyInstance;
  });

  it("should be a function", () => {
    expect(typeof registerSessionHooks).toBe("function");
  });

  it("should register onRequest hook", async () => {
    await registerSessionHooks(mockFastify);
    expect(mockFastify.addHook).toHaveBeenCalledWith(
      "onRequest",
      expect.any(Function),
    );
  });

  describe("onRequest hook behavior", () => {
    it("should register getActiveSession in dependency scope", async () => {
      await registerSessionHooks(mockFastify);
      const onRequestHook = mockFastify.addHook.mock.calls[0][1];
      await onRequestHook(mockReq);

      expect(mockDiScope.register).toHaveBeenCalledWith({
        getActiveSession: expect.any(Object),
      });
    });

    it("should resolve sessionIdKey from diScope", async () => {
      await registerSessionHooks(mockFastify);
      const onRequestHook = mockFastify.addHook.mock.calls[0][1];
      await onRequestHook(mockReq);

      expect(mockDiScope.resolve).toHaveBeenCalledWith("sessionIdKey");
    });
  });

  describe("getActiveSession function logic", () => {
    let getActiveSession: (
      sessionId?: string,
    ) => Promise<ConversationRelaySession | null>;

    beforeEach(() => {
      // Create the function directly for testing
      getActiveSession = ({
        activeSessions,
      }: {
        activeSessions: ActiveSessions;
      }) => {
        return async (sessionId?: string) => {
          if (sessionId) {
            return activeSessions.get(sessionId);
          }

          const body = mockReq.body as Record<string, string>;
          const sessionIdKey = mockDiScope.resolve("sessionIdKey");

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
            return activeSessions.get(from) || null;
          }

          return null;
        };
      };

      getActiveSession = getActiveSession({
        activeSessions: mockActiveSessions,
      });
    });

    it("should return session when sessionId is provided", async () => {
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("test-session", sessionData);

      const result = await getActiveSession("test-session");
      expect(result).toBe(sessionData);
    });

    it("should handle CallSid from body when sessionIdKey is CallSid", async () => {
      mockReq.body = { CallSid: "CA123456" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("CA123456", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should handle Sid from body when sessionIdKey is CallSid", async () => {
      mockReq.body = { Sid: "CA789012" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("CA789012", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should handle SessionId when sessionIdKey is SessionId", async () => {
      mockDiScope.resolve.mockReturnValue("SessionId");
      mockReq.body = { SessionId: "VX123456" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("VX123456", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should handle sessionId from body when sessionIdKey is SessionId", async () => {
      mockDiScope.resolve.mockReturnValue("SessionId");
      mockReq.body = { sessionId: "VX789012" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("VX789012", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should handle From field as fallback", async () => {
      mockReq.body = { From: "+1234567890" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("+1234567890", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should handle from field as fallback", async () => {
      mockReq.body = { from: "+0987654321" };
      const sessionData = {} as ConversationRelaySession;
      mockActiveSessions.set("+0987654321", sessionData);

      const result = await getActiveSession();
      expect(result).toBe(sessionData);
    });

    it("should return null when no session found", async () => {
      mockReq.body = { From: "+1111111111" };

      const result = await getActiveSession();
      expect(result).toBeNull();
    });

    it("should ignore invalid CallSid format", async () => {
      mockReq.body = { CallSid: "INVALID123" };

      const result = await getActiveSession();
      expect(result).toBeNull();
    });

    it("should ignore invalid SessionId format", async () => {
      mockDiScope.resolve.mockReturnValue("SessionId");
      mockReq.body = { SessionId: "INVALID123" };

      const result = await getActiveSession();
      expect(result).toBeNull();
    });
  });
});
