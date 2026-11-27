export type MediaInfo = { status: 'preview' | 'truncated' | 'invalid' | 'external' | 'unsupported'; mime: string; sourceType: string; characters: number; reason: string; src?: string };
export type MediaPart = { kind: 'text'; text: string } | { kind: 'image'; image: MediaInfo };
const supported = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export function isImage(value: any): boolean { return ['image', 'image_url', 'input_image'].includes(value?.type); }
export function imageInfo(value: any): MediaInfo {
  const source = value?.source || {}, uri = value?.image_url?.url ?? (typeof value?.image_url === 'string' ? value.image_url : undefined) ?? source.url ?? value?.url;
  let mime = String(source.media_type ?? value?.media_type ?? ''), data = source.data ?? value?.data, sourceType = String(source.type || (uri ? 'url' : '未知'));
  if (typeof uri === 'string' && uri.startsWith('data:')) {
    const match = uri.match(/^data:([^;,]+);base64,([\s\S]*)$/i);
    if (match) { mime = match[1]; data = match[2]; sourceType = 'base64'; }
  } else if (uri) return { status: 'external', mime, sourceType, characters: 0, reason: '外部图片未自动联网加载，可在消息原文中查看地址。' };
  const characters = typeof data === 'string' ? data.length : 0;
  const info = { mime, sourceType, characters };
  if (typeof data !== 'string' || !data) return { ...info, status: 'invalid', reason: '未提供完整图片数据，可查看消息原文。' };
  if (/truncated|截断|\.{3}|…|\[ph_/i.test(data)) return { ...info, status: 'truncated', reason: '图片数据在源文件中已截断，无法还原预览。可查看消息原文。' };
  mime = mime.toLowerCase();
  if (!supported.has(mime) || sourceType !== 'base64') return { ...info, status: 'unsupported', reason: '暂不支持此图片类型或编码，仅预览内嵌 PNG、JPEG、GIF、WebP。' };
  const clean = data.replace(/\s/g, '');
  if (clean.length > 28 * 1024 * 1024) return { ...info, status: 'unsupported', reason: '图片数据过大，暂不自动解码。可查看消息原文。' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length % 4 === 1) return { ...info, status: 'invalid', reason: 'Base64 数据不完整或格式错误，无法预览。' };
  try {
    const head = atob(clean.slice(0, 32));
    const valid = mime === 'image/png' ? head.startsWith('\x89PNG\r\n\x1a\n') : mime === 'image/jpeg' ? head.startsWith('\xff\xd8\xff') : mime === 'image/gif' ? head.startsWith('GIF87a') || head.startsWith('GIF89a') : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
    if (!valid) return { ...info, status: 'invalid', reason: '图片内容与声明类型不一致或数据已损坏，无法预览。' };
  } catch { return { ...info, status: 'invalid', reason: 'Base64 图片解码失败，可查看消息原文。' }; }
  return { ...info, mime, status: 'preview', reason: '浏览器本地图片预览', src: `data:${mime};base64,${clean}` };
}
function readJson(text: string, start: number): { value: unknown; end: number; raw: string } | undefined {
  if (text[start] !== '{' && text[start] !== '[') return;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') { if (--depth === 0) { const raw = text.slice(start, i + 1); try { return { value: JSON.parse(raw), end: i + 1, raw }; } catch { return { value: undefined, end: i + 1, raw }; } } }
  }
}
function truncatedImage(raw: string): MediaInfo | undefined {
  // 部分轨迹截断器把换行直接写进 data 字符串，破坏了内层 JSON。
  // 只识别显式图片元信息和截断标记；绝不修补或尝试解码缺失数据。
  if (!/^\{\s*"type"\s*:\s*"image"/.test(raw) || !/truncated|截断/i.test(raw)) return;
  const mime = raw.match(/"media_type"\s*:\s*"([^"\r\n]*)"/)?.[1] || '';
  const sourceType = raw.match(/"source"\s*:\s*\{\s*"type"\s*:\s*"([^"\r\n]*)"/)?.[1] || '未知';
  const data = raw.match(/"data"\s*:\s*"([\s\S]*?)"\s*[,}]/)?.[1];
  return { status: 'truncated', mime, sourceType, characters: data?.length || 0, reason: '图片数据在源文件中已截断，且图片文本块不是完整 JSON，无法还原预览。可查看消息原文。' };
}
function inFence(text: string): boolean {
  let fence = '';
  for (const line of text.split('\n')) { const match = line.match(/^\s*(`{3,}|~{3,})/); if (match) { if (!fence) fence = match[1][0]; else if (fence === match[1][0]) fence = ''; } }
  return !!fence;
}
export function mediaParts(content: unknown): MediaPart[] {
  if (Array.isArray(content)) return content.flatMap(mediaParts);
  if (isImage(content)) return [{ kind: 'image', image: imageInfo(content) }];
  if (content && typeof content === 'object') {
    const block = content as any;
    if (block.type === 'tool_result') return mediaParts(block.content);
    if (['text', 'input_text', 'output_text'].includes(block.type)) return mediaParts(block.text ?? '');
    return [{ kind: 'text', text: JSON.stringify(content, null, 2) }];
  }
  const text = typeof content === 'string' ? content : content == null ? '' : String(content);
  try { const value = JSON.parse(text); if (isImage(value) || Array.isArray(value) && value.some(isImage)) return mediaParts(value); } catch {}
  const parts: MediaPart[] = []; let cursor = 0;
  for (const match of text.matchAll(/^[ \t]*\[image\]\s*/gm)) {
    if (match.index < cursor || inFence(text.slice(0, match.index))) continue;
    const json = readJson(text, match.index + match[0].length);
    if (!json) continue;
    const info = isImage(json.value) ? imageInfo(json.value) : truncatedImage(json.raw);
    if (!info) continue;
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
    parts.push({ kind: 'image', image: info }); cursor = json.end;
  }
  if (cursor < text.length || !parts.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}
