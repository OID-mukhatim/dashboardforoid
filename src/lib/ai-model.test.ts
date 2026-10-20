import { describe, expect, it } from "vitest";
import { AI_TEXT_MODEL } from "./ai-model";

describe("shared translation and formula model", () => {
  it("uses the current low-cost Gemini text model rather than Gemini 2.5 Flash", () => {
    expect(AI_TEXT_MODEL).toBe("google/gemini-3.1-flash-lite");
  });
});