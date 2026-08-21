import { actionComment } from './action-comment';
import { now, purchaseById } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

export const unarchivePurchaseTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'unarchive_purchase', description: 'Restore an archived purchase while keeping its history.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const purchase = await purchaseById(context, id);
    if (!purchase.archived_at) return { ok: true, summary: `${purchase.item_name} is already active`, data: { changed: false } };
    const unarchivedAt = now();
    const comment = actionComment(id, 'purchase_unarchived', 'Purchase restored from archive', { prior_archived_at: purchase.archived_at, unarchived_at: unarchivedAt }, context.userId, unarchivedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare('UPDATE purchases SET archived_at = NULL, archived_by = NULL, updated_at = ?, updated_by = ? WHERE id = ?').bind(unarchivedAt, context.userId, id),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await purchaseById(context, id);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase restore batch did not commit exactly once');
    return { ok: true, summary: `Restored ${committed.item_name}`, data: { changed: true, unarchived_at: committed.updated_at } };
  },
};
