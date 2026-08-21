import { now, purchaseById } from './purchases/shared';
import { AgentTool } from './types';
import { stringArg } from './validation';

export const addPurchaseCommentTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'add_purchase_comment', description: 'Append an immutable user comment or URL to a purchase.',
    parameters: { type: 'object', properties: { id: { type: 'string' }, content: { type: 'string' } }, required: ['id', 'content'], additionalProperties: false },
  } },
  async execute(args, context) {
    const id = stringArg(args, 'id', true)!;
    const content = stringArg(args, 'content', true, 4000)!;
    const purchase = await purchaseById(context, id);
    const createdAt = now();
    const commentId = crypto.randomUUID();
    const result = await context.env.DB.prepare(`INSERT INTO purchase_comments
      (id, purchase_id, comment_type, action_type, content, details_json, created_at, created_by)
      VALUES (?, ?, 'user', NULL, ?, NULL, ?, ?)`)
      .bind(commentId, id, content, createdAt, context.userId).run();
    if (result.meta.changes !== 1) throw new Error('comment was not added');
    const committed = await context.env.DB.prepare('SELECT created_at FROM purchase_comments WHERE id = ?').bind(commentId).first<{ created_at: string }>();
    if (!committed) throw new Error('comment was not committed');
    return { ok: true, summary: `Added a comment to ${purchase.item_name}`, data: { created_at: committed.created_at } };
  },
};
