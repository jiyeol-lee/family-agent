import { actionComment } from './action-comment';
import { now, purchaseById, safePurchase } from './purchases/shared';
import { AgentTool } from './types';
import { priceArg, priorityArg, stringArg } from './validation';

export const updatePurchaseTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'update_purchase', description: 'Update only an item name, price, or priority.',
    parameters: { type: 'object', properties: {
      id: { type: 'string' }, item_name: { type: 'string' }, price: { type: ['number', 'null'], minimum: 0 }, priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    }, required: ['id'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const existing = await purchaseById(context, id);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if ('item_name' in args) { const value = stringArg(args, 'item_name', true)!; if (value !== existing.item_name) changes['item_name'] = { from: existing.item_name, to: value }; }
    if ('price' in args) { const value = priceArg(args); if (value !== existing.price) changes['price'] = { from: existing.price, to: value }; }
    if ('priority' in args) { const value = priorityArg(args); if (value !== existing.priority) changes['priority'] = { from: existing.priority, to: value }; }
    if (!Object.keys(changes).length) return { ok: true, summary: 'No purchase changes were needed', data: { purchase: safePurchase(existing), changed: false } };
    const changedAt = now();
    const itemName = (changes['item_name']?.to ?? existing.item_name) as string;
    const price = (changes['price'] ? changes['price'].to : existing.price) as number | null;
    const priority = (changes['priority']?.to ?? existing.priority) as string;
    const comment = actionComment(id, 'purchase_updated', 'Purchase details updated', { changes }, context.userId, changedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare('UPDATE purchases SET item_name = ?, price = ?, priority = ?, updated_at = ?, updated_by = ? WHERE id = ?').bind(itemName, price, priority, changedAt, context.userId, id),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await purchaseById(context, id);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase update batch did not commit exactly once');
    return { ok: true, summary: `Updated ${committed.item_name}`, data: { purchase: safePurchase(committed), changed: true } };
  },
};
