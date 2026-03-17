import { logger } from '../utils/logger';

const conversationLocks = new Map<string, Promise<void>>();

export function buildConversationLockKey(instanceName: string, phone: string): string {
  return `${instanceName}:${phone}`;
}

export function withConversationLock(lockKey: string, fn: () => Promise<void>): Promise<void> {
  const previous = conversationLocks.get(lockKey) ?? Promise.resolve();
  const current = previous
    .then(fn)
    .catch((err) => logger.error(`Error in conversation lock chain [${lockKey}]:`, err))
    .finally(() => {
      if (conversationLocks.get(lockKey) === current) {
        conversationLocks.delete(lockKey);
      }
    });

  conversationLocks.set(lockKey, current);
  return current;
}
