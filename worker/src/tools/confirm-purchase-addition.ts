import { PurchaseRecord } from '../types';
import { actionComment } from './action-comment';
import { similarPurchases } from './find-similar-purchases';
import { now, safePurchase } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

interface Pending {
  id: string; chat_id: string; user_id: string; item_name: string; candidate_json: string;
  status: string; created_update_id: number; expires_at: string;
}

const confirmations = new Set(['yes', 'y', 'confirm', 'add it', 'add anyway']);
const cancellations = new Set(['no', 'n', 'cancel', 'do not add']);

function explicitDecision(messageText: string): 'confirm' | 'cancel' | null {
  const normalized = messageText.toLocaleLowerCase().trim().replace(/\s+/g, ' ');
  if (confirmations.has(normalized)) return 'confirm';
  if (cancellations.has(normalized)) return 'cancel';
  return null;
}

export const confirmPurchaseAdditionTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'confirm_purchase_addition',
    description: 'Confirm or cancel the most recent pending duplicate addition. Confirm only when the user clearly says yes; cancel when they decline.',
    parameters: { type: 'object', properties: {
      pending_id: { type: 'string' }, decision: { type: 'string', enum: ['confirm', 'cancel'] },
    }, required: ['decision'], additionalProperties: false },
  } },
  async execute(args, context) {
    const requestedId = stringArg(args, 'pending_id');
    const decision = explicitDecision(context.messageText);
    if (!decision) {
      return {
        ok: false,
        summary: 'An explicit confirmation or cancellation is required',
        error: 'decision required',
        data: { outcome: 'decision_required' },
      };
    }
    const pending = requestedId
      ? await context.env.DB.prepare('SELECT * FROM pending_purchase_additions WHERE id = ? AND chat_id = ? AND user_id = ?').bind(requestedId, context.chatId, context.userId).first<Pending>()
      : await context.env.DB.prepare("SELECT * FROM pending_purchase_additions WHERE chat_id = ? AND user_id = ? AND status = 'awaiting_confirmation' ORDER BY created_at DESC LIMIT 1").bind(context.chatId, context.userId).first<Pending>();
    if (!pending) {
      return {
        ok: false,
        summary: 'No pending addition is visible yet. Retry the confirmation in a new message.',
        error: 'pending addition not visible',
        data: { outcome: 'retry_confirmation' },
      };
    }
    const pendingId = pending.id;
    const touchedAt = now();
    if (context.updateId <= pending.created_update_id) {
      return {
        ok: false,
        summary: 'Confirmation must arrive in a later Telegram update. Retry the confirmation in a new message.',
        error: 'confirmation update is not later than the pending request',
        data: { outcome: 'retry_confirmation' },
      };
    }
    if (pending.status === 'awaiting_confirmation' && pending.expires_at <= touchedAt) {
      const result = await context.env.DB.prepare("UPDATE pending_purchase_additions SET status = 'expired' WHERE id = ? AND status = 'awaiting_confirmation'").bind(pendingId).run();
      const current = await context.env.DB.prepare('SELECT status FROM pending_purchase_additions WHERE id = ?').bind(pendingId).first<{ status: string }>();
      return { ok: false, summary: current?.status === 'expired' ? 'Confirmation expired' : `Pending addition is already ${current?.status ?? 'handled'}`, error: 'pending addition expired', data: { changed: result.meta.changes === 1, status: current?.status } };
    }
    if (pending.status !== 'awaiting_confirmation') return { ok: true, summary: `Pending addition is already ${pending.status}`, data: { status: pending.status } };
    if (decision === 'cancel') {
      const result = await context.env.DB.prepare("UPDATE pending_purchase_additions SET status = 'cancelled' WHERE id = ? AND status = 'awaiting_confirmation'").bind(pendingId).run();
      const current = await context.env.DB.prepare('SELECT status FROM pending_purchase_additions WHERE id = ?').bind(pendingId).first<{ status: string }>();
      if (result.meta.changes !== 1) return { ok: true, summary: `Pending addition is already ${current?.status ?? 'handled'}`, data: { changed: false, status: current?.status ?? 'handled' } };
      return { ok: true, summary: `Cancelled ${pending.item_name}`, data: { changed: true, status: current?.status } };
    }

    const candidate = JSON.parse(pending.candidate_json) as { item_name: string; price: number | null; priority: string };
    const currentMatches = await similarPurchases(candidate.item_name, context);
    const id = crypto.randomUUID();
    const comment = actionComment(id, 'purchase_created', 'Purchase created after duplicate confirmation', {
      item_name: candidate.item_name, price: candidate.price, priority: candidate.priority,
      duplicate_confirmation: true, similar_purchase_ids: currentMatches.map(({ purchase }) => purchase.id),
    }, context.userId, touchedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare("UPDATE pending_purchase_additions SET status = 'confirmed' WHERE id = ?").bind(pendingId),
      context.env.DB.prepare(`INSERT INTO purchases
        (id, user_id, item_name, price, priority, agreed_by, is_purchased_at, is_purchased_by, archived_at, archived_by, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?)`)
        .bind(id, context.userId, candidate.item_name, candidate.price, candidate.priority, JSON.stringify([context.userId]), touchedAt, touchedAt, context.userId, context.userId),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
      context.env.DB.prepare("UPDATE pending_purchase_additions SET status = 'completed' WHERE id = ?").bind(pendingId),
    ]);
    const committed = await context.env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first<PurchaseRecord>();
    const current = await context.env.DB.prepare('SELECT status FROM pending_purchase_additions WHERE id = ?').bind(pendingId).first<{ status: string }>();
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1 || results[2]?.meta.changes !== 1 || results[3]?.meta.changes !== 1) {
      const counts = results.map((result) => result?.meta.changes ?? 'missing').join(',');
      throw new Error(`confirmation batch change-count mismatch (${counts}); purchase=${committed ? 'present' : 'missing'}, status=${current?.status ?? 'missing'}`);
    }
    if (!committed || current?.status !== 'completed') throw new Error('confirmed purchase was not committed');
    return { ok: true, summary: `Added ${candidate.item_name} after confirmation`, data: { changed: true, status: current.status, purchase: safePurchase(committed) } };
  },
};
