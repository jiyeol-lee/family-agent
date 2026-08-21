export function parseAgreedBy(value: string): string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('purchase agreement data is invalid'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error('purchase agreement data is invalid');
  }
  if (new Set(parsed).size !== parsed.length) throw new Error('purchase agreement data is invalid');
  return parsed;
}
