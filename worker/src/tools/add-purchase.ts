import { PurchaseRecord } from '../types';
import { actionComment } from './action-comment';
import { similarPurchases } from './find-similar-purchases';
import { now, safePurchase } from './purchases/shared';
import { AgentTool } from './types';
import { priceArg, priorityArg, stringArg } from './validation';

export const addPurchaseTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'add_purchase',
    description: 'Add a purchase after duplicate checking. Similar records require confirmation in a later Telegram update.',
    parameters: { type: 'object', properties: {
      item_name: { type: 'string' }, price: { type: ['number', 'null'], minimum: 0 },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    }, required: ['item_name'], additionalProperties: false },
  } },
  async execute(args, context) {
    const itemName = stringArg(args, 'item_name', true)!;
    const candidate = { item_name: itemName, price: priceArg(args), priority: priorityArg(args) };
    const matches = await similarPurchases(itemName, context);
    if (matches.length) {
      const id = crypto.randomUUID();
      const createdAt = now();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const candidates = matches.map(({ purchase }) => safePurchase(purchase));
      const inserted = await context.env.DB.prepare(`INSERT INTO pending_purchase_additions
        (id, chat_id, user_id, item_name, candidate_json, similar_purchase_ids, status, created_update_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, 'awaiting_confirmation', ?, ?, ?)`)
        .bind(id, context.chatId, context.userId, itemName, JSON.stringify(candidate), JSON.stringify(matches.map(({ purchase }) => purchase.id)), context.updateId, createdAt, expiresAt).run();
      if (inserted.meta.changes !== 1) throw new Error('pending confirmation was not saved');
      return {
        ok: true,
        summary: `Confirmation required before adding ${itemName}`,
        stop: true,
        data: {
          outcome: 'requires_user_confirmation', pending_id: id, candidates,
          question: `I found ${candidates.length} similar purchase${candidates.length === 1 ? '' : 's'}. Add "${itemName}" anyway?`,
        },
      };
    }

    const id = crypto.randomUUID();
    const createdAt = now();
    const comment = actionComment(id, 'purchase_created', 'Purchase created', { item_name: itemName, price: candidate.price, priority: candidate.priority }, context.userId, createdAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare(`INSERT INTO purchases
        (id, user_id, item_name, price, priority, agreed_by, is_purchased_at, is_purchased_by, archived_at, archived_by, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?)`)
        .bind(id, context.userId, itemName, candidate.price, candidate.priority, JSON.stringify([context.userId]), createdAt, createdAt, context.userId, context.userId),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await context.env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first<PurchaseRecord>();
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase creation batch did not commit exactly once');
    if (!committed) throw new Error('purchase was not committed');
    return { ok: true, summary: `Added ${itemName}`, data: { purchase: safePurchase(committed) } };
  },
};
