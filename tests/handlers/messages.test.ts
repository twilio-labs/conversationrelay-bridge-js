import { describe, it, expect, vi } from "vitest";
import messagesHandler from "../../src/handlers/messages.js";
import { FastifyInstance } from "fastify";

describe("handlers/messages", () => {
  it("should be a function", () => {
    expect(typeof messagesHandler).toBe("function");
  });

  it("should return an async function", () => {
    const handler = vi.fn();
    const result = messagesHandler(handler);
    expect(typeof result).toBe("function");
    expect(result.constructor.name).toBe("AsyncFunction");
  });

  it("should register POST /messages route", async () => {
    const handler = vi.fn();
    const mockFastify = {
      post: vi.fn(),
    } as unknown as FastifyInstance;

    const routeFunction = messagesHandler(handler);
    await routeFunction(mockFastify);

    expect(mockFastify.post).toHaveBeenCalledWith("/messages", handler);
    expect(mockFastify.post).toHaveBeenCalledTimes(1);
  });
});
