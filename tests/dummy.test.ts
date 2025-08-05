import { describe, it, expect } from "vitest";

describe("Dummy Test", () => {
  it("should pass a basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should verify string equality", () => {
    expect("hello").toBe("hello");
  });

  it("should check array contains", () => {
    const arr = [1, 2, 3];
    expect(arr).toContain(2);
  });
});
