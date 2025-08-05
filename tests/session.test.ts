import { describe, it, expect, vi, beforeEach } from "vitest";
import WebSocket from "ws";
import { FastifyBaseLogger } from "fastify";
import {
  ConversationRelaySession,
  ConversationRelaySessionArgs,
  SetupMessage,
  PromptMessage,
  InterruptMessage,
  DTMFMessage,
  ErrorMessage,
} from "../src/session.js";

describe("ConversationRelaySession", () => {
  let mockConnection: WebSocket;
  let mockLogger: FastifyBaseLogger;
  let sessionArgs: ConversationRelaySessionArgs;
  let session: ConversationRelaySession;

  beforeEach(() => {
    mockConnection = {
      on: vi.fn(),
      send: vi.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as FastifyBaseLogger;

    sessionArgs = {
      connection: mockConnection,
      logger: mockLogger,
      requestId: "test-request-id",
    };

    session = new ConversationRelaySession(sessionArgs);
  });

  describe("constructor", () => {
    it("should initialize with provided arguments", () => {
      expect(session).toBeInstanceOf(ConversationRelaySession);
    });

    it("should set up initial session state", () => {
      const newSession = new ConversationRelaySession(sessionArgs);
      expect(newSession).toBeDefined();
    });
  });

  describe("start method", () => {
    it("should register message event listener", () => {
      session.start();
      expect(mockConnection.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should handle setup message", async () => {
      const setupMessage: SetupMessage = {
        type: "setup",
        callSid: "CA123456",
        sessionId: "VX789012",
        accountSid: "AC123456",
        from: "+1234567890",
        to: "+0987654321",
        direction: "inbound",
        customParameters: { key: "value" },
      };

      const handleSetup = vi.fn();
      session.start(handleSetup);

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(setupMessage)));

      expect(handleSetup).toHaveBeenCalledWith(setupMessage);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { messageType: "setup" },
        "Received message",
      );
    });

    it("should handle prompt message", async () => {
      const promptMessage: PromptMessage = {
        type: "prompt",
        voicePrompt: "Hello",
        lang: "en",
        last: false,
      };

      const handlePromptSpy = vi.spyOn(session, "handlePrompt");
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(promptMessage)));

      expect(handlePromptSpy).toHaveBeenCalledWith(promptMessage);
    });

    it("should handle interrupt message", async () => {
      const interruptMessage: InterruptMessage = {
        type: "interrupt",
        utteranceUntilInterrupt: "Hello world",
        durationUntilInterruptMs: 1000,
      };

      const handleInterruptSpy = vi.spyOn(session, "handleInterrupt");
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(interruptMessage)));

      expect(handleInterruptSpy).toHaveBeenCalledWith(interruptMessage);
    });

    it("should handle DTMF message", async () => {
      const dtmfMessage: DTMFMessage = {
        type: "dtmf",
        digit: "1",
      };

      const handleDTMFSpy = vi.spyOn(session, "handleDTMF");
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(dtmfMessage)));

      expect(handleDTMFSpy).toHaveBeenCalledWith(dtmfMessage);
    });

    it("should handle error message", async () => {
      const errorMessage: ErrorMessage = {
        type: "error",
        description: "Something went wrong",
      };

      const handleErrorSpy = vi.spyOn(session, "handleError");
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(errorMessage)));

      expect(handleErrorSpy).toHaveBeenCalledWith(errorMessage);
    });

    it("should handle unknown message type", async () => {
      const unknownMessage = { type: "unknown" };
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from(JSON.stringify(unknownMessage)));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { type: "unknown" },
        "Unknown message type",
      );
    });

    it("should handle JSON parse errors", async () => {
      session.start();

      const messageHandler = (mockConnection.on as ReturnType<typeof vi.fn>)
        .mock.calls[0][1];
      await messageHandler(Buffer.from("invalid json"));

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: expect.stringContaining("Unexpected token") },
        "Error processing message",
      );
    });
  });

  describe("outbound message methods", () => {
    describe("sendToken", () => {
      it("should send token message with default parameters", () => {
        session.sendToken("hello");

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "text",
            token: "hello",
            last: false,
          }),
        );
        expect(mockLogger.info).toHaveBeenCalledWith("Sending token hello");
      });

      it("should send token message with last=true", () => {
        session.sendToken("world", true);

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "text",
            token: "world",
            last: true,
          }),
        );
      });

      it("should send token message with additional properties", () => {
        session.sendToken("test", false, { lang: "en", interruptible: true });

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "text",
            token: "test",
            last: false,
            lang: "en",
            interruptible: true,
          }),
        );
      });
    });

    describe("play", () => {
      it("should send play message", () => {
        session.play("http://example.com/audio.mp3");

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "play",
            source: "http://example.com/audio.mp3",
          }),
        );
      });

      it("should send play message with additional properties", () => {
        session.play("http://example.com/audio.mp3", {
          loop: 3,
          preemptible: true,
        });

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "play",
            source: "http://example.com/audio.mp3",
            loop: 3,
            preemptible: true,
          }),
        );
      });
    });

    describe("sendDigits", () => {
      it("should send digits message", () => {
        session.sendDigits("123");

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "sendDigits",
            digits: "123",
          }),
        );
      });
    });

    describe("language", () => {
      it("should send language message", () => {
        session.language({
          ttsLanguage: "en-US",
          transcriptionLanguage: "en-US",
        });

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "language",
            ttsLanguage: "en-US",
            transcriptionLanguage: "en-US",
          }),
        );
      });
    });

    describe("end", () => {
      it("should send end message without handoff data", () => {
        session.end();

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "end",
          }),
        );
      });

      it("should send end message with handoff data", () => {
        session.end("handoff-data");

        expect(mockConnection.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "end",
            handoffData: "handoff-data",
          }),
        );
      });
    });

    it("should not send message when WebSocket is not open", () => {
      mockConnection.readyState = WebSocket.CLOSED;
      session.sendToken("test");

      expect(mockConnection.send).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("WebSocket is not open"),
      );
    });
  });

  describe("message handlers", () => {
    it("should handle setup message", async () => {
      const setupMessage: SetupMessage = {
        type: "setup",
        callSid: "CA123456",
        sessionId: "VX789012",
        accountSid: "AC123456",
        from: "+1234567890",
        to: "+0987654321",
        direction: "inbound",
        customParameters: {},
      };

      await session.handleSetup(setupMessage);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Handling setup message: ${JSON.stringify(setupMessage)}`,
      );
    });

    it("should handle prompt message", async () => {
      const promptMessage: PromptMessage = {
        type: "prompt",
        voicePrompt: "Hello",
        lang: "en",
        last: false,
      };

      await session.handlePrompt(promptMessage);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Handling prompt message: ${JSON.stringify(promptMessage)}`,
      );
    });

    it("should handle interrupt message", async () => {
      const interruptMessage: InterruptMessage = {
        type: "interrupt",
        utteranceUntilInterrupt: "Hello",
        durationUntilInterruptMs: 1000,
      };

      await session.handleInterrupt(interruptMessage);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Handling interrupt message: ${JSON.stringify(interruptMessage)}`,
      );
    });

    it("should handle DTMF message", async () => {
      const dtmfMessage: DTMFMessage = {
        type: "dtmf",
        digit: "1",
      };

      await session.handleDTMF(dtmfMessage);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Handling DTMF message: ${JSON.stringify(dtmfMessage)}`,
      );
    });

    it("should handle error message", async () => {
      const errorMessage: ErrorMessage = {
        type: "error",
        description: "Something went wrong",
      };

      await session.handleError(errorMessage);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Handling error message: ${JSON.stringify(errorMessage)}`,
      );
    });
  });

  describe("close method", () => {
    it("should call handleClose", async () => {
      const handleCloseSpy = vi.spyOn(session, "handleClose");
      await session.close();
      expect(handleCloseSpy).toHaveBeenCalled();
    });

    it("should handle close event", async () => {
      await session.handleClose();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "WebSocket connection closed",
      );
    });
  });
});
