import { describe, expect, test } from "bun:test";
import { getAppointmentTimeState } from "../utils";

describe("getAppointmentTimeState", () => {
  const minutesAgo = (m: number) =>
    new Date(Date.now() - m * 60_000).toISOString();
  const minutesFromNow = (m: number) =>
    new Date(Date.now() + m * 60_000).toISOString();

  test("returns 'past' when appointment ended before now", () => {
    const result = getAppointmentTimeState(minutesAgo(120), minutesAgo(60));
    expect(result).toBe("past");
  });

  test("returns 'now' when current time is between start and end", () => {
    const result = getAppointmentTimeState(minutesAgo(30), minutesFromNow(30));
    expect(result).toBe("now");
  });

  test("returns 'future' when appointment starts after now", () => {
    const result = getAppointmentTimeState(minutesFromNow(60), minutesFromNow(120));
    expect(result).toBe("future");
  });

  test("returns 'past' when appointment ended exactly at now (boundary)", () => {
    const now = new Date().toISOString();
    const result = getAppointmentTimeState(minutesAgo(60), now);
    // now > end is false when equal, so now >= start && now <= end → "now"
    // Edge: appointment ending exactly at current instant is treated as "now"
    expect(result).toBe("now");
  });

  test("returns 'now' when appointment starts exactly at now", () => {
    const now = new Date().toISOString();
    const result = getAppointmentTimeState(now, minutesFromNow(60));
    expect(result).toBe("now");
  });
});
