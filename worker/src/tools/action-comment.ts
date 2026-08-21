export function actionComment(
  purchaseId: string,
  actionType: string,
  content: string,
  details: Record<string, unknown>,
  actor: string,
  createdAt: string,
): { sql: string; values: unknown[] } {
  return {
    sql: `INSERT INTO purchase_comments
      (id, purchase_id, comment_type, action_type, content, details_json, created_at, created_by)
      VALUES (?, ?, 'action', ?, ?, ?, ?, ?)`,
    values: [crypto.randomUUID(), purchaseId, actionType, content, JSON.stringify({ schema_version: 1, ...details }), createdAt, actor],
  };
}
