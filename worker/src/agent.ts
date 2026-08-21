import { executeTool, toolDefinitions, ToolContext, ToolResult } from './tools';
import { Env } from './types';

interface AgentToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: AgentToolCall[];
}

interface CompletionResponse {
  choices?: Array<{ message?: AgentMessage }>;
  error?: { message?: string };
}

const systemPrompt = `You are Family Agent, a concise assistant for shared family tasks. Purchase Wishlist is one capability.
Use tools to read or change stored data. Never claim a write succeeded unless its result has ok=true. Dates are UTC ISO strings and prices are US dollars.
For a new purchase, get the minimum item identity first. Call find_similar_purchases before asking any optional or required follow-up question, and search all active, purchased, archived, and commented records. Then call add_purchase when ready. The server repeats this duplicate check.
If add_purchase returns outcome requires_user_confirmation, stop immediately and ask its exact question. Do not call another tool in that Telegram update. Confirmation must be a later message whose normalized text is exactly yes, y, confirm, add it, or add anyway. Cancellation must be exactly no, n, cancel, or do not add. Do not infer a decision from other text.
Purchase completion is irreversible. Agreements cannot be removed. Comments and action history cannot be edited or deleted. Purchases can be archived and restored, but never deleted. Actor identities come from the trusted Telegram message and must not be requested as tool arguments.`;

function outcomeSummary(outcomes: ToolResult[]): string {
  const lines = outcomes.slice(0, 12).map((outcome) => `- ${outcome.ok ? 'Completed' : 'Not completed'}: ${outcome.summary}`);
  if (outcomes.length > lines.length) lines.push(`- ${outcomes.length - lines.length} more tool outcomes omitted`);
  return `The assistant could not finish its response. These tool outcomes were already recorded; do not repeat completed changes blindly:\n${lines.join('\n')}`.slice(0, 3500);
}

async function recentMessages(env: Env, chatId: string): Promise<AgentMessage[]> {
  const result = await env.DB.prepare('SELECT role, content FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20')
    .bind(chatId).all<{ role: 'user' | 'assistant'; content: string }>();
  return result.results.reverse();
}

export async function saveChatMessage(env: Env, chatId: string, userId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO chat_messages (chat_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(chatId, userId, role, content.slice(0, 8000), new Date().toISOString()),
    env.DB.prepare(`DELETE FROM chat_messages WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 100
    )`).bind(chatId, chatId),
  ]);
}

async function completion(env: Env, messages: AgentMessage[], deadlineAt: number): Promise<AgentMessage> {
  const baseUrl = (env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1').replace(/\/$/, '');
  const remaining = deadlineAt - Date.now();
  if (remaining < 500) throw new Error('Assistant processing deadline reached');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENCODE_GO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.ZEN_MODEL || 'deepseek-v4-flash', messages, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.2 }),
    signal: AbortSignal.timeout(Math.min(7_000, remaining)),
  });
  let body: CompletionResponse;
  try { body = await response.json<CompletionResponse>(); } catch { throw new Error(`Zen returned an unreadable response (${response.status})`); }
  if (!response.ok) throw new Error(body.error?.message || `Zen request failed (${response.status})`);
  const message = body.choices?.[0]?.message;
  if (!message || message.role !== 'assistant') throw new Error('Zen returned no assistant message');
  return message;
}

export async function runAgent(context: ToolContext, deadlineAt: number): Promise<string> {
  const messages: AgentMessage[] = [{ role: 'system', content: systemPrompt }, ...await recentMessages(context.env, context.chatId)];
  const outcomes: ToolResult[] = [];
  for (let round = 0; round < 5; round += 1) {
    let assistant: AgentMessage;
    try {
      assistant = await completion(context.env, messages, deadlineAt);
    } catch (error) {
      if (outcomes.length) return outcomeSummary(outcomes);
      throw error;
    }
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (!calls.length) return assistant.content?.trim() || 'Done.';
    for (const call of calls) {
      const result = await executeTool(call.function.name, call.function.arguments, context);
      outcomes.push(result);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      if (result.stop) {
        const data = result.data as { question?: unknown } | undefined;
        return typeof data?.question === 'string' ? data.question : result.summary;
      }
    }
  }
  const successes = outcomes.filter((outcome) => outcome.ok).map((outcome) => `- ${outcome.summary}`);
  const failures = outcomes.filter((outcome) => !outcome.ok).map((outcome) => `- ${outcome.summary}`);
  return `I reached the processing limit.\nSucceeded:\n${successes.join('\n') || '- none'}\nFailed:\n${failures.join('\n') || '- none'}`;
}
