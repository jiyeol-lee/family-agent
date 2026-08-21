import { allPurchasesWithComments, safePurchase } from './purchases/shared';
import { AgentTool, ToolContext } from './types';
import { stringArg } from './validation';

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export async function similarPurchases(itemName: string, context: ToolContext) {
  const query = normalize(itemName);
  const queryTokens = new Set(query.split(' ').filter((token) => token.length > 1));
  const records = await allPurchasesWithComments(context);
  return records.flatMap((record) => {
    const item = normalize(record.item_name);
    const commentText = normalize(record.comments.map((comment) => comment.content).join(' '));
    const itemTokens = new Set(item.split(' ').filter((token) => token.length > 1));
    const overlap = [...queryTokens].filter((token) => itemTokens.has(token)).length;
    const score = query === item ? 3 : item.includes(query) || query.includes(item) ? 2 : overlap > 0 && overlap / Math.max(queryTokens.size, itemTokens.size) >= 0.5 ? 1 : commentText.includes(query) ? 1 : 0;
    return score ? [{ score, purchase: record }] : [];
  }).sort((a, b) => b.score - a.score || a.purchase.item_name.localeCompare(b.purchase.item_name));
}

export const findSimilarPurchasesTool: AgentTool = {
  definition: { type: 'function', function: {
    name: 'find_similar_purchases',
    description: 'Check every purchase and its comments for likely duplicates before asking follow-up questions or adding an item.',
    parameters: { type: 'object', properties: { item_name: { type: 'string' } }, required: ['item_name'], additionalProperties: false },
  } },
  async execute(args, context) {
    const matches = await similarPurchases(stringArg(args, 'item_name', true)!, context);
    const candidates = matches.map(({ purchase }) => safePurchase(purchase));
    return { ok: true, summary: `${candidates.length} similar record${candidates.length === 1 ? '' : 's'} found`, data: { candidates } };
  },
};
