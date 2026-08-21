import { actionComment } from './action-comment';
import { now, purchaseById } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

export const archivePurchaseTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'archive_purchase', description: 'Archive an active purchase without deleting its history.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const purchase = await purchaseById(context, id);
    if (purchase.archived_at) return { ok: true, summary: `${purchase.item_name} is already archived`, data: { changed: false, archived_at: purchase.archived_at } };
    const archivedAt = now();
    const comment = actionComment(id, 'purchase_archived', 'Purchase archived', { archived_at: archivedAt }, context.userId, archivedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare('UPDATE purchases SET archived_at = ?, archived_by = ?, updated_at = ?, updated_by = ? WHERE id = ?').bind(archivedAt, context.userId, archivedAt, context.userId, id),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await purchaseById(context, id);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase archive batch did not commit exactly once');
    return { ok: true, summary: `Archived ${committed.item_name}`, data: { changed: true, archived_at: committed.archived_at } };
  },
};
