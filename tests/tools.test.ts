import test from 'node:test';
import assert from 'node:assert/strict';
import { toolBlocks, toolJson } from '../src/toolBlocks';
import { normalizeTrace } from '../src/model';
test('multiple tool markers, leading text and empty tool result all preserved', () => {
  const blocks = toolBlocks('说明\n[tool_use:Bash] {"command":"pwd"}\n\n[tool_use:Read]\n{"path":"/tmp/x"}\n[tool_result:id]\n');
  assert.deepEqual(blocks.map(b => b.kind), ['text', 'use', 'use', 'result']);
  assert.equal(toolJson(blocks[1].text)?.command, 'pwd'); assert.equal(blocks[3].name, 'id');
});
test('tool result role without marker and markers inside fences', () => {
  assert.equal(toolBlocks('中文日志\n下一行', 'tool')[0].kind, 'result');
  const blocks = toolBlocks('```text\n[tool_use:Bash] example\n```\n[tool_result]\n{"ok":true}');
  assert.equal(blocks.length, 2); assert.equal(blocks[0].kind, 'text'); assert.deepEqual(toolJson(blocks[1].text), { ok: true });
});
test('native Anthropic and OpenAI tool data normalize into cards without shifting indices', () => {
  const out = normalizeTrace([{ role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'pwd' } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: [{ type: 'text', text: 'done' }] }] }, { role: 'assistant', tool_calls: [{ function: { name: 'Read', arguments: '{"path":"a"}' } }] }, { role: 'tool', content: '{"ok":true}' }]);
  assert.deepEqual(out.messages.map(m => m.index), [0, 1, 2, 3]);
  assert.deepEqual(out.messages.map(m => toolBlocks(m.text, m.role)[0].kind), ['use', 'result', 'use', 'result']);
});
test('tool JSON fenced, arrays, scalars and invalid parameters', () => {
  assert.deepEqual(toolJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(toolJson('[1,2]'), [1,2]); assert.equal(toolJson('false'), false); assert.equal(toolJson('bad json'), undefined);
});
