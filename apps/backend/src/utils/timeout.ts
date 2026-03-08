import { logger } from './logger';

/** Wraps a promise with a timeout. Rejects with an error if the timeout expires. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      logger.error(`Timeout (${ms}ms) for: ${label}`);
      reject(new Error(`Timeout: ${label} exceeded ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
