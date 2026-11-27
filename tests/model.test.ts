import test from 'node:test';
import assert from 'node:assert/strict';
import { childPath, valueAt, pathLabel, fieldsOf, inferFields, normalizeTrace, jsonHits, offsets, findCall, ancestors, rowMeta, resultJson } from '../src/model';

test('JSON pointer preserves special keys and primitive roots', () => {
  const source = { 'a/b': { 'x~y': [{ role: 'user' }] }, 'x.y': false };
  const path = childPath(childPath('', 'a/b'), 'x~y');
  assert.equal(path, '/a~1b/x~0y'); assert.deepEqual(valueAt(source, path), [{ role: 'user' }]);
  assert.equal(valueAt(source, '/x.y'), false); assert.equal(valueAt(source, '/missing'), undefined);
  assert.equal(valueAt('x', ''), 'x'); assert.ok(pathLabel('/a~1b').includes('a/b')); assert.ok(fieldsOf(source).includes(path));
  assert.deepEqual(ancestors('/a/b/0'), ['', '/a', '/a/b']);
});
test('field recommendation supports request.messages, no result2 forced', () => {
  assert.deepEqual(inferFields({ request: { messages: [] }, result: {} }), { trace: '/request/messages', result1: '/result', result2: '@none' });
  assert.equal(inferFields({ wrapper: { inputs: [] } }).trace, '/wrapper/inputs');
});
test('messages preserve original indices and OpenAI tool calls', () => {
  const result = normalizeTrace([{ role: 'user', content: '你好' }, { role: 'assistant', content: null, tool_calls: [{ function: { name: 'test', arguments: '{}' } }] }, { role: 'tool', content: 'ok' }], '/messages');
  assert.deepEqual(result.messages.map(m => m.index), [0, 1, 2]); assert.equal(result.messages[2].path, '/messages/2'); assert.match(result.messages[1].text, /tool_use:test/);
});
test('inputs envelope keeps system separate without shifting indices', () => {
  const result = normalizeTrace({ system: '规则', messages: [{ from: 'human', value: '问题' }, { from: 'gpt', value: '答案' }] }, '/inputs');
  assert.deepEqual(result.messages.map(m => m.role), ['system', 'user', 'assistant']);
  assert.deepEqual(result.messages.map(m => m.index), [null, 0, 1]); assert.equal(result.messages[2].path, '/inputs/messages/1');
});
test('JSON string messages anchor original view to actual string leaf', () => {
  const result = normalizeTrace(JSON.stringify({ messages: [{ role: 'user', content: '输入' }] }), '/inputs');
  assert.equal(result.messages[0].index, 0); assert.equal(result.messages[0].path, '/inputs');
});
test('Anthropic content, role aliases, image privacy and unknown entries', () => {
  const result = normalizeTrace([{ from: 'human', content: [{ type: 'text', text: '多模态' }, { type: 'image_url', image_url: { url: 'https://example.invalid/a.png' } }] }, { role: 'assistant', content: [{ type: 'tool_use', name: 'read', input: { file: 'x' } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: 'done' }] }, { something: 10 }]);
  assert.match(result.messages[0].text, /未自动联网加载/); assert.match(result.messages[1].text, /tool_use:read/); assert.match(result.messages[2].text, /tool_result:1/); assert.equal(result.messages[3].role, 'unknown'); assert.ok(result.warnings.length);
});
test('history pairs and named fields do not invent indices', () => {
  const result = normalizeTrace({ history: [['问', '答']], prompt: '新问题' }, '/inputs');
  assert.deepEqual(result.messages.map(m => m.role), ['user', 'assistant', 'user']); assert.ok(result.messages.every(m => m.index === null));
  const named = normalizeTrace({ prompt: '问题', assistant: '答复' }, '/inputs');
  assert.deepEqual(named.messages.map(m => m.role), ['user', 'assistant']); assert.ok(named.messages.every(m => m.index === null));
  const single = normalizeTrace({ role: 'user', content: '一个消息' }); assert.equal(single.messages[0].role, 'user'); assert.equal(single.messages[0].index, null);
});
test('unrecognized inputs preserve original structure, without guessed role', () => {
  const input = { task: '业务任务', options: { a: 1 } }; const result = normalizeTrace(input);
  assert.equal(result.messages[0].role, 'unknown'); assert.equal(result.messages[0].raw, input); assert.match(result.messages[0].text, /业务任务/);
  assert.equal(normalizeTrace(undefined).messages.length, 0);
});
test('case insensitive exact-occurrence search includes keys and primitive values', () => {
  assert.deepEqual(offsets('a TEST test', 'test'), [2, 7]);
  const hits = jsonHits({ test: ['test TEST', { x: true }] }, 'test');
  assert.equal(hits.length, 3); assert.equal(hits[0].kind, 'key'); assert.equal(hits[1].path, '/test/0');
  assert.equal(jsonHits({ empty: '' }, '').length, 0);
});
test('call indices use actual field, ignore references when recordsOnly', () => {
  const source = { rule: { call_index: 4 }, calls: [{ call_index: 4, name: 'read' }, { call_index: 9, name: 'write' }] };
  assert.deepEqual(findCall(source, 4), ['/rule', '/calls/0']); assert.deepEqual(findCall(source, 4, true), ['/calls/0']);
  assert.equal(findCall(source, 0).length, 0); assert.equal(findCall({ call_index: '' }, 0).length, 0);
});
test('row metadata identifies nested user and duplicate IDs remain independent', () => {
  const value = { id: 'same', request: { messages: [{ role: 'tool', content: 'x'.repeat(1000000) }, { role: 'user', content: '内容\n输入' }] } };
  const row = rowMeta(value, 7, 20, 50); assert.equal(row.preview, '内容 输入'); assert.equal(row.id, 'same'); assert.equal(row.line, 7);
});
test('JSON-string results become trees, invalid strings and scalars stay intact', () => {
  assert.deepEqual(resultJson('{"message_index":2}'), { message_index: 2 });
  assert.equal(resultJson('not json'), 'not json'); assert.equal(resultJson('42'), '42'); assert.equal(resultJson('null'), 'null');
  assert.equal(normalizeTrace([{ role: 'assistant', content: null }]).messages[0].text, '');
});
