import { processTelegramUpdate, tokensMatch } from './telegram';
import { parseAgreedBy } from './agreed-by';
import { Env, PublicPurchase, PublicPurchaseComment, TelegramUpdate } from './types';

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((value) => value.trim());
  const allowOrigin = allowed.includes('*') ? '*' : origin && allowed.includes(origin) ? origin : allowed[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, env: Env, value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: corsHeaders(request, env) });
}

async function parseJson<T>(request: Request): Promise<T> {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }
  return request.json<T>();
}

async function finishTelegramUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  try {
    await processTelegramUpdate(env, update);
    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE telegram_updates SET status = 'completed', updated_at = ?, completed_at = ?, error = NULL WHERE update_id = ?",
    ).bind(completedAt, completedAt, update.update_id).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    console.error(`Telegram update ${update.update_id} failed`, error);
    try {
      const failedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE telegram_updates SET status = 'failed', updated_at = ?, failed_at = ?, error = ? WHERE update_id = ?",
      ).bind(failedAt, failedAt, message.slice(0, 2000), update.update_id).run();
    } catch (statusError) {
      console.error(`Could not mark Telegram update ${update.update_id} failed`, statusError);
    }
  }
}

async function route(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  if (request.method === 'GET' && url.pathname === '/api/v1/health') {
    return json(request, env, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/purchases') {
    const scope = url.searchParams.get('scope') ?? 'active';
    if (!['active', 'archived', 'all'].includes(scope)) return json(request, env, { error: 'scope must be active, archived, or all' }, 400);
    const where = scope === 'active' ? 'WHERE archived_at IS NULL' : scope === 'archived' ? 'WHERE archived_at IS NOT NULL' : '';
    type PurchaseRow = Omit<PublicPurchase, 'comments' | 'agreed_count'> & { agreed_by: string };
    type CommentRow = Omit<PublicPurchaseComment, 'details'> & { purchase_id: string; details_json: string | null };
    const results = await env.DB.batch([
      env.DB.prepare(`SELECT id, item_name, price, priority, is_purchased_at, archived_at,
        agreed_by, created_at, updated_at
        FROM purchases ${where} ORDER BY updated_at DESC, id`),
      env.DB.prepare(`SELECT c.id, c.purchase_id, c.comment_type, c.action_type, c.content, c.details_json, c.created_at
        FROM purchase_comments c JOIN purchases p ON p.id = c.purchase_id ${where ? where.replace('archived_at', 'p.archived_at') : ''}
        ORDER BY c.created_at, c.id`),
    ]);
    const purchaseResult = results[0] as D1Result<PurchaseRow>;
    const commentResult = results[1] as D1Result<CommentRow>;
    const comments = new Map<string, PublicPurchaseComment[]>();
    for (const { purchase_id, details_json, ...comment } of commentResult.results) {
      let details: unknown = null;
      if (details_json) { try { details = JSON.parse(details_json); } catch { details = null; } }
      comments.set(purchase_id, [...(comments.get(purchase_id) ?? []), { ...comment, details }]);
    }
    const purchases = purchaseResult.results.map(({ agreed_by, ...purchase }) => ({
      ...purchase,
      agreed_count: parseAgreedBy(agreed_by).length,
      comments: comments.get(purchase.id) ?? [],
    }));
    return json(request, env, { purchases });
  }

  if (request.method === 'POST' && url.pathname === '/api/telegram/webhook') {
    const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!tokensMatch(token, env.TELEGRAM_WEBHOOK_SECRET)) {
      return json(request, env, { error: 'Unauthorized' }, 401);
    }
    let update: TelegramUpdate;
    try {
      update = await parseJson<TelegramUpdate>(request);
    } catch (error) {
      return json(request, env, { error: error instanceof Error ? error.message : 'Invalid JSON' }, 400);
    }
    if (!update || typeof update.update_id !== 'number') return json(request, env, { error: 'Invalid Telegram update' }, 400);
    const now = new Date().toISOString();
    const claim = await env.DB.prepare(`INSERT OR IGNORE INTO telegram_updates
      (update_id, status, received_at, updated_at) VALUES (?, 'processing', ?, ?)`)
      .bind(update.update_id, now, now).run();
    if (!claim.meta.changes) return json(request, env, { ok: true });
    context.waitUntil(finishTelegramUpdate(env, update));
    return json(request, env, { ok: true });
  }

  return json(request, env, { error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, context);
    } catch (error) {
      console.error('Unhandled request error', error);
      return json(request, env, { error: 'Internal server error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
