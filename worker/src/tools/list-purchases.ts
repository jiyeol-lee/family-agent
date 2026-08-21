import { allPurchasesWithComments, safePurchase } from './purchases/shared';
import { AgentTool } from './types';
import { enumArg, stringArg } from './validation';

export const listPurchasesTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'list_purchases', description: 'List purchases with comments. Active records are returned by default.',
    parameters: { type: 'object', properties: {
      scope: { type: 'string', enum: ['active', 'archived', 'all'] },
      status: { type: 'string', enum: ['all', 'pending', 'purchased'] }, search: { type: 'string' },
    }, additionalProperties: false },
  } },
  async execute(args, context) {
    const scope = enumArg(args, 'scope', ['active', 'archived', 'all'] as const, 'active');
    const status = enumArg(args, 'status', ['all', 'pending', 'purchased'] as const, 'all');
    const search = (stringArg(args, 'search') ?? '').toLocaleLowerCase();
    const records = (await allPurchasesWithComments(context)).filter((purchase) => {
      const scopeMatch = scope === 'all' || (scope === 'active' ? !purchase.archived_at : !!purchase.archived_at);
      const statusMatch = status === 'all' || (status === 'purchased' ? !!purchase.is_purchased_at : !purchase.is_purchased_at);
      const textMatch = !search || [purchase.item_name, ...purchase.comments.map((comment) => comment.content)].some((value) => value.toLocaleLowerCase().includes(search));
      return scopeMatch && statusMatch && textMatch;
    }).map(safePurchase);
    return { ok: true, summary: `Listed ${records.length} purchase${records.length === 1 ? '' : 's'}`, data: { purchases: records } };
  },
};
