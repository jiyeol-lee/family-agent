import { actionComment } from './action-comment';
import { now, purchaseById } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

export const markPurchasePurchasedTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'mark_purchase_purchased', description: 'Permanently mark a purchase as purchased. This cannot be undone.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const purchase = await purchaseById(context, id);
    if (purchase.is_purchased_at) return { ok: true, summary: `${purchase.item_name} was already purchased`, data: { changed: false, is_purchased_at: purchase.is_purchased_at } };
    const purchasedAt = now();
    const comment = actionComment(id, 'purchase_marked_purchased', 'Purchase marked purchased', { purchased_at: purchasedAt }, context.userId, purchasedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare('UPDATE purchases SET is_purchased_at = ?, is_purchased_by = ?, updated_at = ?, updated_by = ? WHERE id = ?').bind(purchasedAt, context.userId, purchasedAt, context.userId, id),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await purchaseById(context, id);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase completion batch did not commit exactly once');
    return { ok: true, summary: `Marked ${committed.item_name} purchased`, data: { changed: true, is_purchased_at: committed.is_purchased_at } };
  },
};
