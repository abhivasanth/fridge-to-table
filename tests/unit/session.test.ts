import { describe, it, expect, beforeEach } from "vitest";
import { getSessionId } from "@/lib/session";

describe("getSessionId", () => {
  beforeEach(() => {
    // Clear localStorage before each test to start fresh
    localStorage.clear();
  });

  it("generates a new UUID v4 and stores it on first call", () => {
    const id = getSessionId();
    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(localStorage.getItem("fridge_session_id")).toBe(id);
  });

  it("returns the same ID on every subsequent call", () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it("returns an existing ID from localStorage", () => {
    const existingId = "123e4567-e89b-42d3-a456-426614174000";
    localStorage.setItem("fridge_session_id", existingId);
    expect(getSessionId()).toBe(existingId);
  });

  it("ignores a corrupt localStorage value and generates a fresh ID", () => {
    localStorage.setItem("fridge_session_id", "not-a-uuid");
    const id = getSessionId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(localStorage.getItem("fridge_session_id")).toBe(id);
    expect(id).not.toBe("not-a-uuid");
  });
});
