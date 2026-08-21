import { runAgent, saveChatMessage } from './agent';
import { Env, TelegramUpdate } from './types';

export function tokensMatch(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function chatAllowed(chatId: string, configured?: string): boolean {
  if (!configured?.trim()) return true;
  return configured.split(',').map((id) => id.trim()).filter(Boolean).includes(chatId);
}

async function sendMessage(env: Env, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096) }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage failed (${response.status})`);
}

export async function processTelegramUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  // Stay comfortably inside Workers' post-response waitUntil window.
  const processingDeadline = Date.now() + 18_000;
  const message = update.message;
  if (!message?.text?.trim() || !message.from) return;
  const chatId = String(message.chat.id);
  const userId = String(message.from.id);
  if (!chatAllowed(chatId, env.ALLOWED_CHAT_IDS)) {
    await sendMessage(env, chatId, 'This chat is not authorized to use Family Agent.');
    return;
  }

  const input = message.text.trim();
  await saveChatMessage(env, chatId, userId, 'user', input);
  let answer: string;
  try {
    answer = await runAgent({ env, chatId, userId, updateId: update.update_id, messageText: input }, processingDeadline);
  } catch (error) {
    console.error('Assistant failed', error);
    answer = 'I could not process that request right now. No unconfirmed operation should be assumed successful; please try again.';
  }
  await saveChatMessage(env, chatId, userId, 'assistant', answer);
  await sendMessage(env, chatId, answer);
}
