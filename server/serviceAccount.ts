/** Parse the Render secret even when pasted with literal newlines or stray escapes. */
export function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const candidates = [raw, raw.trim()];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "string") return JSON.parse(parsed);
      return parsed as Record<string, unknown>;
    } catch {}
  }
  const repaired = raw.replace(/\r?\n/g, "\\n").replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  const parsed = JSON.parse(repaired);
  if (typeof parsed === "string") return JSON.parse(parsed);
  return parsed as Record<string, unknown>;
}
