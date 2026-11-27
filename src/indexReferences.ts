export type IndexConfig = { aliases: string[]; bracketed: boolean; disabled?: string[] };
export type IndexKind = 'message' | 'call';
export type IndexReference = { kind: IndexKind; index: number; start: number; end: number; label: string };
export const DEFAULT_INDEX_CONFIG: IndexConfig = { aliases: [], bracketed: false };
const messageKey = /^(?:\w*_)?message_?(?:index|indices|indexes)$/i;
const callKey = /^call_?(?:index|indices|indexes)$/i;
export function normalizeAliases(text: string): string[] {
  const aliases = [...new Set(text.split(/[,，;；\n]+/).map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase()))];
  if (aliases.length > 32 || aliases.some(s => s.length > 80)) throw new Error('最多配置32个别名，每个不超过80个字符。');
  if (aliases.some(s => callKey.test(s))) throw new Error('call_index 及其变体保留用于调用记录，请不要配置为消息轮次。');
  return aliases.filter(s => !messageKey.test(s));
}
export function indexKind(key: string, config = DEFAULT_INDEX_CONFIG): IndexKind | undefined {
  if (callKey.test(key)) return 'call';
  if (config.disabled?.includes(key.toLowerCase())) return;
  if (messageKey.test(key) || /^tool_?call_?(?:chain|链路)$/i.test(key) || config.aliases.includes(key.toLowerCase())) return 'message';
}
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const indexNumber = (text: string) => /^\d+$/.test(text) && Number.isSafeInteger(Number(text));
// 只匹配非负整数，不将小数、负数、普通单词后缀或科学计数法截成轮次。
const valuePattern = '(?:\\[\\s*\\d+(?:\\s*[,，]\\s*\\d+)*\\s*\\]|\\d+)(?![A-Za-z0-9_.-])';
export function indexReferences(text: string, config = DEFAULT_INDEX_CONFIG, kind?: IndexKind): IndexReference[] {
  const refs: IndexReference[] = [];
  const add = (value: string, start: number, type: IndexKind, label: string) => {
    for (const token of value.matchAll(/\d+/g)) if (indexNumber(token[0])) refs.push({ kind: type, index: Number(token[0]), start: start + token.index!, end: start + token.index! + token[0].length, label });
  };
  if (kind) {
    // 整串就是一个索引值（4 / [4, 5] / 4→5）时按该类型解析
    if (/^\s*(?:\d+|\[\s*\d+(?:\s*[,，]\s*\d+)*\s*\]|\d+(?:\s*(?:[,，→]|->)\s*\d+)+)\s*$/.test(text)) { add(text, 0, kind, kind === 'message' ? 'message_index' : 'call_index'); return refs; }
    // 否则（长文本/链路描述）继续按正文扫描，避免整段字符串里的引用全部丢失
  }
  const names = ['(?:\\w*_)?message_?(?:index|indices|indexes)', 'call_?(?:index|indices|indexes)', ...config.aliases.slice().sort((a, b) => b.length - a.length).map(escapePattern)];
  const pattern = new RegExp('(?<![A-Za-z0-9_])(' + names.join('|') + ')(?![A-Za-z0-9_])\\s*["\']?\\s*[:=：]\\s*(' + valuePattern + ')', 'giu');
  const occupied: { start: number; end: number }[] = [];
  for (const match of text.matchAll(pattern)) {
    const start = match.index! + match[0].length - match[2].length;
    if (!config.disabled?.includes(match[1].toLowerCase()) || callKey.test(match[1])) add(match[2], start, callKey.test(match[1]) ? 'call' : 'message', match[1]);
    occupied.push({ start: match.index!, end: match.index! + match[0].length });
  }
  if (config.bracketed) for (const match of text.matchAll(/\[\s*\d+(?:\s*[,，]\s*\d+)*\s*\]/g)) {
    if (!occupied.some(r => match.index! >= r.start && match.index! < r.end)) add(match[0], match.index!, 'message', '[数字]');
  }
  return refs.sort((a, b) => a.start - b.start).filter((ref, i, all) => i === 0 || ref.start !== all[i - 1].start);
}
