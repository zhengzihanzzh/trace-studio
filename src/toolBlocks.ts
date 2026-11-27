export type ToolBlock = { kind: 'text' | 'use' | 'result'; name: string; text: string };
export function toolBlocks(text: string, role = ''): ToolBlock[] {
  const blocks: ToolBlock[] = []; let kind: ToolBlock['kind'] = 'text', name = '', lines: string[] = [], fence = '';
  function flush() { const body = lines.join('\n').trim(); if (body || kind !== 'text') blocks.push({ kind, name, text: body }); lines = []; }
  for (const line of text.split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (fence === f[1][0]) fence = ''; lines.push(line); continue; }
    const marker = !fence && line.match(/^\s*\[tool_(use|result)(?::([^\]]*))?\]\s*(.*)$/);
    if (marker) { flush(); kind = marker[1] === 'use' ? 'use' : 'result'; name = marker[2] || ''; lines.push(marker[3]); }
    else lines.push(line);
  }
  flush();
  if (role === 'tool' && blocks.every(b => b.kind === 'text')) return [{ kind: 'result', name: '', text }];
  return blocks;
}
export function toolJson(text: string): unknown {
  try { return JSON.parse(text); } catch { const fence = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/); if (fence) { try { return JSON.parse(fence[1]); } catch {} } return undefined; }
}
