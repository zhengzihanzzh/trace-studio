export type Json = any;
export type Row = { start: number; end: number; line: number; id: string; source: string; preview: string; error?: string; fileKey?: number; fileName?: string };
export type ChatMessage = { role: string; sourceRole: string; index: number | null; path: string; text: string; raw: Json };
export type Normalized = { messages: ChatMessage[]; warnings: string[]; format: string };
export const NONE = '@none', AUTO = '@auto';
export const escapePointer = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1');
export const childPath = (path: string, key: string | number) => path + '/' + escapePointer(String(key));
export function pathParts(path: string): string[] { return path ? path.slice(1).split('/').map(x => x.replace(/~1/g, '/').replace(/~0/g, '~')) : []; }
export function valueAt(value: Json, path: string): Json { if (path === NONE) return undefined; return pathParts(path).reduce((v, key) => v !== null && typeof v === 'object' && Object.hasOwn(v, key) ? v[key] : undefined, value); }
export const pathLabel = (path: string) => '$' + pathParts(path).map(key => /^[\w\u4e00-\u9fff]+$/.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']').join('');
export function parseLine(line: string): Json { return JSON.parse(line.replace(/^\uFEFF/, '').trim()); }
export function fieldsOf(value: Json): string[] {
  const paths: string[] = [];
  function walk(v: Json, path: string, depth: number) { if (!v || typeof v !== 'object' || Array.isArray(v) || depth > 4 || paths.length > 512) return; for (const key of Object.keys(v)) { const next = childPath(path, key); paths.push(next); walk(v[key], next, depth + 1); } }
  walk(value, '', 0); return paths;
}
export function inferFields(value: Json): { trace: string; result1: string; result2: string } {
  const trace = ['/messages', '/inputs', '/input/messages', '/request/messages', '/request/inputs', '/input', '/conversation', '/conversations', '/request', '/prompt'].find(path => valueAt(value, path) !== undefined) ?? fieldsOf(value).find(path => /\/(messages|inputs|conversations|trajectory)$/.test(path)) ?? NONE;
  const result1 = ['/result', '/results', '/output', '/evaluation', '/response'].find(path => valueAt(value, path) !== undefined) ?? NONE;
  return { trace, result1, result2: NONE };
}
export function roleName(role: Json): string {
  const r = String(role ?? 'unknown').toLowerCase();
  return ({ human: 'user', gpt: 'assistant', ai: 'assistant', bot: 'assistant', developer: 'system', function: 'tool', observation: 'tool' } as Record<string, string>)[r] || r;
}
const stringValue = (v: Json) => typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v, null, 2);
export function contentText(content: Json): string {
  if (content === null || content === undefined) return '';
  if (!Array.isArray(content)) return stringValue(content);
  return content.map(block => {
    if (typeof block === 'string') return block;
    if (block?.type === 'text' || block?.type === 'input_text' || block?.type === 'output_text') return stringValue(block.text);
    if (block?.type === 'thinking') return '[thinking]\n' + stringValue(block.thinking);
    if (block?.type === 'tool_use' || block?.type === 'function_call') return '[tool_use:' + (block.name || 'unknown') + ']\n' + stringValue(block.input ?? block.arguments);
    if (block?.type === 'tool_result') return '[tool_result:' + (block.tool_use_id || '') + ']\n' + contentText(block.content);
    if (/image/.test(block?.type || '')) return '[图片内容 · 原始字段中查看；未自动联网加载]\n' + stringValue(block.image_url?.url || block.source?.type || block.type);
    return stringValue(block);
  }).join('\n\n');
}
export function normalizeTrace(input: Json, basePath = ''): Normalized {
  const warnings: string[] = [], messages: ChatMessage[] = [];
  let format = 'messages', envelope: Json, envelopePath = basePath, base = basePath, value = input, stringPath: string | undefined;
  for (let depth = 0; depth < 6; depth++) {
    if (typeof value === 'string') { try { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object') { stringPath ??= base; value = parsed; format = 'JSON 字符串'; continue; } } catch {} break; }
    if (Array.isArray(value)) break;
    if (!value || typeof value !== 'object') break;
    if ((value.role !== undefined || value.from !== undefined || value.user !== undefined || value.assistant !== undefined) && !['messages', 'inputs', 'input', 'request', 'conversations', 'conversation', 'turns', 'chat'].some(k => Object.hasOwn(value, k))) break;
    const key = ['messages', 'conversations', 'conversation', 'turns', 'chat', 'inputs', 'input', 'request', 'prompt'].find(k => Object.hasOwn(value, k));
    if (!key) break;
    if (value.system !== undefined) { envelope = value.system; envelopePath = childPath(base, 'system'); }
    if (Array.isArray(value.history)) {
      value.history.forEach((turn: Json, index: number) => {
        if (Array.isArray(turn) && turn.length === 2) {
          messages.push({ role: 'user', sourceRole: 'history[0]', index: null, path: stringPath ?? childPath(childPath(base, 'history'), index), text: contentText(turn[0]), raw: turn[0] });
          messages.push({ role: 'assistant', sourceRole: 'history[1]', index: null, path: stringPath ?? childPath(childPath(base, 'history'), index), text: contentText(turn[1]), raw: turn[1] });
        } else {
          const normalized = normalizeTrace([turn], childPath(base, 'history'));
          messages.push(...normalized.messages.map(m => ({ ...m, index: null, path: stringPath ?? childPath(childPath(base, 'history'), index) })));
        }
      });
      messages.push({ role: 'user', sourceRole: key, index: null, path: stringPath ?? childPath(base, key), text: contentText(value[key]), raw: value[key] });
      if (envelope !== undefined) messages.unshift({ role: 'system', sourceRole: 'system', index: null, path: stringPath ?? envelopePath, text: contentText(envelope), raw: envelope });
      return { messages, warnings: ['history + prompt 不含统一原始消息数组，不编造 message_index。'], format: 'history + prompt' };
    }
    base = childPath(base, key); value = value[key]; format = key;
  }
  if (envelope !== undefined) messages.push({ role: 'system', sourceRole: 'system', index: null, path: stringPath ?? envelopePath, text: contentText(envelope), raw: envelope });
  if (!Array.isArray(value)) {
    if (value === undefined || value === null) return { messages, warnings: ['该字段不存在或为空；请选择其他轨迹字段。'], format: '未提供' };
    if (value && typeof value === 'object' && (value.role !== undefined || value.from !== undefined)) {
      const normalized = normalizeTrace([value]);
      messages.push(...normalized.messages.map(m => ({ ...m, index: null, path: stringPath ?? base })));
      warnings.push('该字段是单条消息而非数组，没有原始 message_index。');
    } else if (value && typeof value === 'object' && ['system', 'user', 'assistant', 'prompt', 'query'].some(k => k in value)) {
      for (const key of ['system', 'user', 'prompt', 'query', 'assistant']) if (value[key] !== undefined) messages.push({ role: key === 'prompt' || key === 'query' ? 'user' : key, sourceRole: key, index: null, path: stringPath ?? childPath(base, key), text: contentText(value[key]), raw: value[key] });
      warnings.push('该结构没有原始消息数组：按具名字段显示，不编造 message_index。');
    } else { messages.push({ role: 'unknown', sourceRole: '原始输入', index: null, path: stringPath ?? base, text: contentText(value), raw: value }); warnings.push('未识别为消息数组：保留原始输入，不推断角色或虚构执行过程。'); }
    return { messages, warnings, format: '原始输入' };
  }
  value.forEach((item: Json, index: number) => {
    const rawRole = item?.role ?? item?.from ?? item?.author?.role ?? item?.message?.role ?? item?.speaker;
    const v = item?.message && typeof item.message === 'object' ? item.message : item;
    const role = rawRole !== undefined ? roleName(rawRole) : v?.type === 'function_call' ? 'assistant' : v?.type === 'function_call_output' ? 'tool' : 'unknown';
    const content = typeof v === 'string' ? v : v && typeof v === 'object' && Object.hasOwn(v, 'content') ? v.content : v?.value ?? v?.text ?? v?.parts ?? v?.output;
    let text = content !== undefined ? contentText(content) : v?.tool_calls?.length ? '' : stringValue(v);
    if (v?.type === 'function_call') text = '[tool_use:' + (v.name || 'unknown') + ']\n' + stringValue(v.arguments ?? v.input);
    if (v?.reasoning_content) text = '[thinking]\n' + contentText(v.reasoning_content) + (text ? '\n\n' + text : '');
    if (v?.tool_calls?.length) text += (text ? '\n\n' : '') + v.tool_calls.map((call: Json) => '[tool_use:' + (call.function?.name || call.name || 'unknown') + ']\n' + stringValue(call.function?.arguments ?? call.arguments ?? call.input)).join('\n\n');
    messages.push({ role, sourceRole: String(rawRole ?? role), index, path: stringPath ?? childPath(base, index), text, raw: item });
  });
  if (messages.some(m => m.role === 'unknown')) warnings.push('部分条目没有可识别角色，已标为 UNKNOWN 并保留原文。');
  return { messages, warnings, format };
}
export function rowMeta(value: Json, line: number, start: number, end: number): Row {
  const id = value?.qid ?? value?.id ?? value?.uid ?? value?.input_id ?? value?.instance_id ?? value?.result?.id ?? '第 ' + line + ' 行';
  const inferred = inferFields(value); let input = valueAt(value, inferred.trace), preview = '';
  // Metadata indexing should not stringify every tool response in every record.
  for (let depth = 0; depth < 7; depth++) {
    if (typeof input === 'string') { try { input = JSON.parse(input); continue; } catch { preview = input.slice(0, 500); break; } }
    if (Array.isArray(input)) { const user = input.find(m => roleName(m?.role ?? m?.from ?? m?.message?.role ?? m?.speaker) === 'user'); if (user) { const m = user.message ?? user; preview = contentText(m.content ?? m.value ?? m.text ?? m.parts).slice(0, 500); } break; }
    if (!input || typeof input !== 'object') break;
    const key = ['messages', 'inputs', 'input', 'request', 'conversations', 'conversation', 'prompt', 'query', 'user'].find(k => Object.hasOwn(input, k));
    if (!key) break; input = input[key];
  }
  return { line, start, end, id: stringValue(id).slice(0, 300), source: stringValue(value?.source ?? value?.trial_seq ?? '').slice(0, 180), preview: preview.replace(/\s+/g, ' ').slice(0, 160) };
}
export type Hit = { path: string; kind: 'key' | 'value'; offset: number };
export function resultJson(value: Json): Json { if (typeof value !== 'string') return value; try { const parsed = JSON.parse(value); return parsed !== null && typeof parsed === 'object' ? parsed : value; } catch { return value; } }
export function offsets(text: string, query: string): number[] { if (!query) return []; const input = text.toLowerCase(), q = query.toLowerCase(), out = []; for (let i = input.indexOf(q); i !== -1; i = input.indexOf(q, i + q.length)) out.push(i); return out; }
export function jsonHits(value: Json, query: string): Hit[] {
  if (!query.trim()) return []; const hits: Hit[] = [];
  function visit(v: Json, path: string) { if (v !== null && typeof v === 'object') { for (const key of Object.keys(v)) { const p = childPath(path, key); if (!Array.isArray(v)) for (const offset of offsets(key, query)) hits.push({ path: p, kind: 'key', offset }); visit(v[key], p); } } else for (const offset of offsets(stringValue(v), query)) hits.push({ path, kind: 'value', offset }); }
  visit(value, ''); return hits;
}
export function ancestors(path: string): string[] { const parts = pathParts(path); return parts.map((_, i) => parts.slice(0, i).reduce((p, key) => childPath(p, key), '')); }
export const nodeId = (panel: string, path: string) => panel + '-node-' + encodeURIComponent(path || '$');
export function findCall(value: Json, index: number, recordsOnly = false): string[] {
  const matches: string[] = []; function walk(v: Json, path: string) {
    if (!v || typeof v !== 'object') return;
    const isRecord = ['name', 'tool_name', 'tool', 'tool_call', 'function', 'arguments', 'input', 'output', 'response', 'command', '工具', '工具名', '工具名称', '参数', '调用参数', '返回结果'].some(key => Object.hasOwn(v, key)) || /\/(tool_?call(?:_?records|s|记录)?|calls|调用记录)(?:\/|$)/i.test(path);
    if (v.call_index !== null && v.call_index !== undefined && /^\d+$/.test(String(v.call_index)) && Number(v.call_index) === index && (!recordsOnly || isRecord)) matches.push(path);
    for (const key of Object.keys(v)) if (key !== 'call_index') walk(v[key], childPath(path, key));
  } walk(value, ''); return matches;
}
