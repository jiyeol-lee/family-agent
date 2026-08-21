import { Env } from '../types';

export type ToolArguments = Record<string, unknown>;

export interface ToolContext {
  env: Env;
  userId: string;
  chatId: string;
  updateId: number;
  messageText: string;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
  stop?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentTool {
  definition: ToolDefinition;
  execute(args: ToolArguments, context: ToolContext): Promise<ToolResult>;
}
