import { PurchaseRecord } from '../../types';
import { parseAgreedBy } from '../../agreed-by';
import { ToolContext } from '../types';

export interface CommentRecord {
  id: string;
  purchase_id: string;
  comment_type: 'user' | 'action';
  action_type: string | null;
  content: string;
  details_json: string | null;
  created_at: string;
}

export function now(): string { return new Date().toISOString(); }

export async function purchaseById(context: ToolContext, id: string): Promise<PurchaseRecord> {
  const purchase = await context.env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first<PurchaseRecord>();
  if (!purchase) throw new Error('purchase not found');
  return purchase;
}

export async function allPurchasesWithComments(context: ToolContext): Promise<Array<PurchaseRecord & { comments: CommentRecord[] }>> {
  const results = await context.env.DB.batch([
    context.env.DB.prepare('SELECT * FROM purchases ORDER BY updated_at DESC, id'),
    context.env.DB.prepare('SELECT id, purchase_id, comment_type, action_type, content, details_json, created_at FROM purchase_comments ORDER BY created_at, id'),
  ]);
  const purchases = results[0] as D1Result<PurchaseRecord>;
  const comments = results[1] as D1Result<CommentRecord>;
  const grouped = new Map<string, CommentRecord[]>();
  for (const comment of comments.results) grouped.set(comment.purchase_id, [...(grouped.get(comment.purchase_id) ?? []), comment]);
  return purchases.results.map((purchase) => ({ ...purchase, comments: grouped.get(purchase.id) ?? [] }));
}

export function safePurchase(purchase: PurchaseRecord & { comments?: CommentRecord[] }): Record<string, unknown> {
  return {
    id: purchase.id,
    item_name: purchase.item_name,
    price: purchase.price,
    priority: purchase.priority,
    status: purchase.archived_at ? 'archived' : purchase.is_purchased_at ? 'purchased' : 'pending',
    is_purchased_at: purchase.is_purchased_at,
    archived_at: purchase.archived_at,
    agreed_count: parseAgreedBy(purchase.agreed_by).length,
    created_at: purchase.created_at,
    updated_at: purchase.updated_at,
    comments: purchase.comments?.map(({ id, comment_type, action_type, content, details_json, created_at }) => ({
      id, comment_type, action_type, content, details: details_json ? JSON.parse(details_json) : null, created_at,
    })),
  };
}
