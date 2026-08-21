import { addPurchaseCommentTool } from './add-purchase-comment';
import { addPurchaseTool } from './add-purchase';
import { agreePurchaseTool } from './agree-purchase';
import { archivePurchaseTool } from './archive-purchase';
import { confirmPurchaseAdditionTool } from './confirm-purchase-addition';
import { findSimilarPurchasesTool } from './find-similar-purchases';
import { listPurchasesTool } from './list-purchases';
import { markPurchasePurchasedTool } from './mark-purchase-purchased';
import { withPurchaseMutationLock } from './purchases/mutation-lock';
import { AgentTool, ToolContext, ToolResult } from './types';
import { unarchivePurchaseTool } from './unarchive-purchase';
import { updatePurchaseTool } from './update-purchase';

const tools: AgentTool[] = [
  findSimilarPurchasesTool, confirmPurchaseAdditionTool, addPurchaseTool, listPurchasesTool,
  updatePurchaseTool, markPurchasePurchasedTool, addPurchaseCommentTool, agreePurchaseTool,
  archivePurchaseTool, unarchivePurchaseTool,
];

const registry = new Map<string, AgentTool>();
const mutationTools = new Set([
  'add_purchase', 'confirm_purchase_addition', 'update_purchase', 'mark_purchase_purchased',
  'add_purchase_comment', 'agree_purchase', 'archive_purchase', 'unarchive_purchase',
]);
for (const tool of tools) {
  const name = tool.definition.function.name;
  if (registry.has(name)) throw new Error(`duplicate tool name: ${name}`);
  registry.set(name, tool);
}

export const toolDefinitions = tools.map((tool) => tool.definition);

export async function executeTool(name: string, rawArguments: string, context: ToolContext): Promise<ToolResult> {
  try {
    const parsed: unknown = JSON.parse(rawArguments || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('arguments must be an object');
    const tool = registry.get(name);
    if (!tool) throw new Error(`unknown tool: ${name}`);
    const execute = () => tool.execute(parsed as Record<string, unknown>, context);
    return mutationTools.has(name) ? await withPurchaseMutationLock(context, execute) : await execute();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'tool failed';
    return { ok: false, summary: message, error: message };
  }
}

export type { ToolContext, ToolResult } from './types';
