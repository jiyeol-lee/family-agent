import { parseAgreedBy } from '../agreed-by';
import { actionComment } from './action-comment';
import { now, purchaseById } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

export const agreePurchaseTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'agree_purchase', description: 'Add the requesting Telegram user to the agreement list. Agreement cannot be withdrawn.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const purchase = await purchaseById(context, id);
    const agreed = parseAgreedBy(purchase.agreed_by);
    if (agreed.includes(context.userId)) return { ok: true, summary: `You already agreed to ${purchase.item_name}`, data: { changed: false, agreed_count: agreed.length } };
    const changedAt = now();
    const next = [...agreed, context.userId];
    const comment = actionComment(id, 'purchase_agreed', 'Agreement added', { before_count: agreed.length, after_count: next.length }, context.userId, changedAt);
    const results = await context.env.DB.batch([
      context.env.DB.prepare('UPDATE purchases SET agreed_by = ?, updated_at = ?, updated_by = ? WHERE id = ?')
        .bind(JSON.stringify(next), changedAt, context.userId, id),
      context.env.DB.prepare(comment.sql).bind(...comment.values),
    ]);
    const committed = await purchaseById(context, id);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw new Error('purchase agreement batch did not commit exactly once');
    const committedAgreed = parseAgreedBy(committed.agreed_by);
    return { ok: true, summary: `Agreed to ${committed.item_name}`, data: { changed: true, agreed_count: committedAgreed.length } };
  },
};
