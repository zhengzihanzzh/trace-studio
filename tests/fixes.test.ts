import test from 'node:test';
import assert from 'node:assert/strict';
import { findCall, NONE } from '../src/model';
import { callTargets } from '../src/callTargets';
import { fieldCopyText } from '../src/FieldCopy';
import { indexKind } from '../src/JsonTree';
import { imageInfo, mediaParts } from '../src/media';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=';
const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } };
test('中文调用记录识别，同一绝对字段结果2优先，排除引用', () => {
  const calls = [{ 工具: 'Read', call_index: 7, message_index: 15, 参数: { file_path: 'x' } }];
  const parent = { tool_call链路: { call_index: [7] }, tool_call记录: calls };
  assert.deepEqual(findCall(parent, 7, true), ['/tool_call记录/0']);
  assert.deepEqual(callTargets({ result1: '/result/all', result2: '/result/all/tool_call记录' }, { result1: parent, result2: calls }, 7), [
    { panel: 'result2', path: '/0', absolute: '/result/all/tool_call记录/0' },
  ]);
  assert.equal(callTargets({ result1: '/a', result2: '/b' }, { result1: calls, result2: calls }, 7).length, 2);
  assert.equal(callTargets({ result1: NONE, result2: '/b' }, { result1: calls, result2: calls }, 7).length, 1);
  assert.deepEqual(findCall({ tool_call记录: [{ call_index: 7 }] }, 7, true), ['/tool_call记录/0']);
  assert.deepEqual(findCall({ 引用: { call_index: 7 } }, 7, true), []);
});
test('消息与调用索引颜色种类保持区分，包括result_message_index', () => {
  for (const key of ['message_index', 'result_message_index', 'tool_call链路']) assert.equal(indexKind(key), 'message');
  assert.equal(indexKind('call_index'), 'call');
  assert.equal(indexKind('unrelated'), undefined);
});
test('字段复制完整对象、长文本及标记不变', () => {
  const text = '中文[ph_real_name_1_ph]'.repeat(2000), object = { messages: Array.from({ length: 101 }, (_, i) => ({ i, text })) };
  assert.equal(fieldCopyText(text), text);
  assert.deepEqual(JSON.parse(fieldCopyText(object)), object);
  assert.equal(fieldCopyText(null), 'null'); assert.equal(fieldCopyText(false), 'false');
});
test('内嵌Base64与data URI、native数组、工具返回均识别', () => {
  assert.equal(imageInfo(image).status, 'preview');
  assert.equal(imageInfo({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + png } }).src, imageInfo(image).src);
  assert.deepEqual(mediaParts([{ type: 'text', text: '前文' }, { type: 'tool_result', content: [image] }]).map(p => p.kind), ['text', 'image']);
  assert.equal(mediaParts(JSON.stringify(image))[0].kind, 'image');
});
test('文本标记多图和前后内容保留，代码围栏示例不解析', () => {
  const text = '前文\n[image] ' + JSON.stringify(image) + '\n中间\n[image] ' + JSON.stringify(image) + '\n后文';
  const parts = mediaParts(text);
  assert.deepEqual(parts.map(p => p.kind), ['text', 'image', 'text', 'image', 'text']);
  assert.ok(parts[0].kind === 'text' && parts[0].text.includes('前文'));
  assert.ok(parts[4].kind === 'text' && parts[4].text.includes('后文'));
  assert.deepEqual(mediaParts('```json\n[image] ' + JSON.stringify(image) + '\n```').map(p => p.kind), ['text']);
});
test('真实截断器在data内插入换行导致内层JSON损坏时仍展示不可还原提示', () => {
  const raw = '[image] {"type":"image","source":{"type":"base64","data":"/9j/abc\n…[truncated 81091 chars]…\n/Z","media_type":"image/jpeg"}}';
  const parts = mediaParts(raw);
  assert.equal(parts.length, 1);
  assert.ok(parts[0].kind === 'image' && parts[0].image.status === 'truncated' && parts[0].image.mime === 'image/jpeg' && !parts[0].image.src);
});
test('截断、非法、非白名单和外部URL不生成图片src', () => {
  for (const [candidate, status] of [
    [{ ...image, source: { ...image.source, data: '/9j/...[truncated 81091 chars].../Z' } }, 'truncated'],
    [{ ...image, source: { ...image.source, data: 'not%base64' } }, 'invalid'],
    [{ ...image, source: { ...image.source, data: 'aGVsbG8=' } }, 'invalid'],
    [{ ...image, source: { ...image.source, media_type: 'image/svg+xml' } }, 'unsupported'],
    [{ type: 'image', source: { type: 'url', url: 'https://example.invalid/x.jpg' } }, 'external'],
  ] as const) { const info = imageInfo(candidate); assert.equal(info.status, status); assert.equal(info.src, undefined); }
});
test('长图片输入保持全部数据，不受阅读裁剪影响', () => {
  const longData = png.replace(/=+$/, '') + 'A'.repeat(14000);
  const output = '[image] ' + JSON.stringify({ ...image, source: { ...image.source, data: longData } });
  const parts = mediaParts(output);
  assert.equal(parts.length, 1);
  assert.ok(parts[0].kind === 'image' && parts[0].image.src?.length === longData.length + 'data:image/png;base64,'.length);
  const native = mediaParts([{ type: 'text', text: '前文' }, { type: 'tool_result', tool_use_id: 'c7', content: [image] }]);
  assert.deepEqual(native.map(p => p.kind), ['text', 'image']);
});
