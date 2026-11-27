export type PasteFormat = 'auto' | 'json' | 'jsonl';
export function preparePaste(text: string, requested: PasteFormat = 'auto'): { format: 'json' | 'jsonl'; count: number } {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('请先粘贴 JSON 或 JSONL 内容。');
  if (requested !== 'jsonl') {
    try { JSON.parse(clean); return { format: 'json', count: 1 }; }
    catch { if (requested === 'json') throw new Error('JSON 格式不完整或不合法，请检查引号、括号和逗号。当前列表未更改。'); }
  }
  let count = 0;
  const lines = clean.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try { JSON.parse(lines[i]); count++; }
    catch { throw new Error(`无法解析第 ${i + 1} 行。JSONL 每行必须是一条完整 JSON；多行 JSON 请使用自动识别或 JSON 格式。当前列表未更改。`); }
  }
  return { format: 'jsonl', count };
}
