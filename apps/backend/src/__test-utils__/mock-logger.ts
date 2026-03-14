import { mock } from 'bun:test';

export function createMockLogger() {
  return {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };
}
