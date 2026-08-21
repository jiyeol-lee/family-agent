import { ToolContext } from '../types';

const LOCK_NAME = 'purchase-ledger';
const LEASE_SECONDS = 60;
const WAIT_MS = 1_200;
const RETRY_MS = 60;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function withPurchaseMutationLock<T>(context: ToolContext, operation: () => Promise<T>): Promise<T> {
  const owner = `${context.chatId}:${context.updateId}:${crypto.randomUUID()}`;
  const waitUntil = Date.now() + WAIT_MS;
  let acquired = false;

  while (!acquired) {
    // The 60-second database-time lease exceeds the approximately 30-second
    // waitUntil lifetime, so takeover starts only after the old invocation is dead.
    const result = await context.env.DB.prepare(`INSERT INTO application_locks (name, owner, expires_at)
      VALUES (?, ?, unixepoch() + ?)
      ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
      WHERE application_locks.expires_at <= unixepoch()`)
      .bind(LOCK_NAME, owner, LEASE_SECONDS).run();
    acquired = result.meta.changes === 1;
    if (acquired) break;
    if (Date.now() >= waitUntil) throw new Error('Purchase changes are busy. Please retry shortly.');
    await sleep(RETRY_MS);
  }

  try {
    return await operation();
  } finally {
    try {
      await context.env.DB.prepare('DELETE FROM application_locks WHERE name = ? AND owner = ?')
        .bind(LOCK_NAME, owner).run();
    } catch (error) {
      console.error('Could not release purchase mutation lock', error);
    }
  }
}
