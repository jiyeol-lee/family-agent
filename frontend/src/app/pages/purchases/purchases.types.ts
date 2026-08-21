type TPriority = 'low' | 'medium' | 'high';

export interface TPurchase {
  id: string;
  item_name: string;
  price: number | null;
  priority: TPriority;
  is_purchased_at: string | null;
  archived_at: string | null;
  agreed_count: number;
  created_at: string;
  updated_at: string;
  comments: TPurchaseComment[];
}

export interface TPurchaseComment {
  id: string;
  comment_type: 'user' | 'action';
  action_type: string | null;
  content: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface TPurchasesResponse {
  purchases: TPurchase[];
}
