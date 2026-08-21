import { ToolArguments } from './types';

export function stringArg(args: ToolArguments, name: string, required = false, max = 1000): string | null {
  const value = args[name];
  if (value === undefined || value === null) {
    if (required) throw new Error(`${name} is required`);
    return null;
  }
  if (typeof value !== 'string' || (required && !value.trim())) throw new Error(`${name} must be text`);
  return value.trim().slice(0, max);
}

export function priceArg(args: ToolArguments, name = 'price'): number | null {
  const value = args[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number or null`);
  return Math.round(value * 100) / 100;
}

export function priorityArg(args: ToolArguments): 'low' | 'medium' | 'high' {
  const value = args['priority'] ?? 'medium';
  if (value !== 'low' && value !== 'medium' && value !== 'high') throw new Error('priority must be low, medium, or high');
  return value;
}

export function enumArg<T extends string>(args: ToolArguments, name: string, values: readonly T[], fallback: T): T {
  const value = args[name] ?? fallback;
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`${name} is invalid`);
  return value as T;
}
