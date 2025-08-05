import { describe, it, expect, vi } from "vitest";
import twimlHandler from "../../src/handlers/twiml.js";
import { FastifyInstance } from "fastify";

describe("handlers/twiml", () => {
  it("should be a function", () => {
    expect(typeof twimlHandler).toBe("function");
  });

  it("should return an async function", () => {
    const handler = vi.fn();
    const result = twimlHandler(handler);
    expect(typeof result).toBe("function");
    expect(result.constructor.name).toBe("AsyncFunction");
  });

  it("should register GET and POST /twiml routes", async () => {
    const handler = vi.fn();
    const mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as FastifyInstance;

    const routeFunction = twimlHandler(handler);
    await routeFunction(mockFastify);

    expect(mockFastify.get).toHaveBeenCalledWith("/twiml", handler);
    expect(mockFastify.post).toHaveBeenCalledWith("/twiml", handler);
    expect(mockFastify.get).toHaveBeenCalledTimes(1);
    expect(mockFastify.post).toHaveBeenCalledTimes(1);
  });
});
