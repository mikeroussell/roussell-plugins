import { describe, expect, it } from "vitest";
import { PLUGIN_NAME } from "../src/index.js";

describe("toolchain", () => {
  it("runs TypeScript tests", () => {
    expect(PLUGIN_NAME).toBe("transcribe");
  });
});
