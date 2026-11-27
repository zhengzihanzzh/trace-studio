import { fieldsOf, parseLine, rowMeta, type Row } from './model';
export type FileFormat = 'json' | 'jsonl';
export function fileFormat(name: string): FileFormat { return /\.json$/i.test(name) ? 'json' : 'jsonl'; }
export async function indexFile(file: Blob, progress: (loaded: number, count: number) => void = () => {}, format: FileFormat = 'jsonl'): Promise<{ rows: Row[]; fields: string[]; blanks: number }> {
  if (format === 'json') {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    progress(file.size, text.trim() ? 1 : 0);
    if (!text.trim()) return { rows: [], fields: [], blanks: 1 };
    try { const value = parseLine(text); return { rows: [rowMeta(value, 1, 0, file.size)], fields: fieldsOf(value), blanks: 0 }; }
    catch (error) { return { rows: [{ start: 0, end: file.size, line: 1, id: 'JSON 解析错误', source: '', preview: '', error: String((error as Error).message) }], fields: [], blanks: 0 }; }
  }
  const rows: Row[] = [], fields = new Set<string>(); let blanks = 0, line = 1, start = 0, absolute = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let parts: Uint8Array[] = [];
  function finish(end: number) {
    let bytes: Uint8Array;
    if (parts.length === 1) bytes = parts[0]; else { const total = parts.reduce((n, part) => n + part.length, 0); bytes = new Uint8Array(total); let at = 0; for (const part of parts) { bytes.set(part, at); at += part.length; } }
    parts = [];
    try { const text = decoder.decode(bytes); if (!text.trim()) { blanks++; return; } const value = parseLine(text); rows.push(rowMeta(value, line, start, end)); for (const path of fieldsOf(value)) if (fields.size < 512) fields.add(path); }
    catch (error) { rows.push({ start, end, line, id: '解析错误 · 第 ' + line + ' 行', source: '', preview: '', error: String((error as Error).message) }); }
  }
  const reader = file.stream().getReader();
  try { while (true) { const { done, value } = await reader.read(); if (done) break; let segment = 0; for (let i = 0; i < value.length; i++) if (value[i] === 10) { parts.push(value.subarray(segment, i)); finish(absolute + i); line++; start = absolute + i + 1; segment = i + 1; } if (segment < value.length) parts.push(value.subarray(segment)); absolute += value.length; progress(absolute, rows.length); } if (parts.length) finish(absolute); }
  finally { reader.releaseLock(); }
  return { rows, fields: [...fields], blanks };
}
if (typeof self !== 'undefined' && typeof document === 'undefined') self.onmessage = async event => {
  let updated = 0;
  try { const result = await indexFile(event.data.file, (loaded, count) => { if (performance.now() - updated > 100 || loaded === event.data.file.size) { updated = performance.now(); self.postMessage({ type: 'progress', loaded, count }); } }, event.data.format ?? fileFormat(event.data.file.name || '')); self.postMessage({ type: 'done', ...result }); }
  catch (error) { self.postMessage({ type: 'error', error: String((error as Error).message) }); }
};
