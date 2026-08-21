export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  OPENCODE_GO_API_KEY: string;
  ZEN_MODEL?: string;
  ZEN_BASE_URL?: string;
  ALLOWED_CHAT_IDS?: string;
  ALLOWED_ORIGINS?: string;
}

export interface PublicPurchase {
  id: string;
  item_name: string;
  price: number | null;
  priority: 'low' | 'medium' | 'high';
  is_purchased_at: string | null;
  archived_at: string | null;
  agreed_count: number;
  created_at: string;
  updated_at: string;
  comments: PublicPurchaseComment[];
}

export interface PublicPurchaseComment {
  id: string;
  comment_type: 'user' | 'action';
  action_type: string | null;
  content: string;
  details: unknown;
  created_at: string;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  item_name: string;
  price: number | null;
  priority: 'low' | 'medium' | 'high';
  agreed_by: string;
  is_purchased_at: string | null;
  is_purchased_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; username?: string };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
