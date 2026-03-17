import { describe, expect, test } from "bun:test";
import { getEscalationDisplayText } from "../tab-general-state";

describe("getEscalationDisplayText", () => {
  test("uses the draft value when it differs from persisted data", () => {
    expect(getEscalationDisplayText("5491112345678", "5490000000000")).toBe(
      "5491112345678"
    );
  });

  test("falls back to persisted value when the draft is empty", () => {
    expect(getEscalationDisplayText("", "5490000000000")).toBe("5490000000000");
  });

  test("shows the empty state when neither value exists", () => {
    expect(getEscalationDisplayText("   ", null)).toBe("No configurado");
  });
});
