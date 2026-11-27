import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePaste } from '../src/pasteInput';
test('自动识别多行单条JSON，数组及原始值也是单条', () => {
  for (const text of ['{\n  "id": "001",\n  "messages": []\n}', '[{"id":1},{"id":2}]', 'null', '"单条文本"']) assert.deepEqual(preparePaste(text), { format: 'json', count: 1 });
});
test('自动JSONL解析多条、空行、CRLF、BOM', () => {
  assert.deepEqual(preparePaste('\uFEFF{"id":"001"}\r\n\r\n{"id":"002"}\n'), { format: 'jsonl', count: 2 });
});
test('格式可显式指定，一行JSONL仍是一条，JSON模式不误接受多条', () => {
  assert.deepEqual(preparePaste('{"id":1}', 'jsonl'), { format: 'jsonl', count: 1 });
  assert.throws(() => preparePaste('{"id":1}\n{"id":2}', 'json'), /JSON 格式/);
  assert.throws(() => preparePaste('{\n"id":1\n}', 'jsonl'), /第 1 行/);
});
test('非法及空文本提示且不产生可导入输入', () => {
  assert.throws(() => preparePaste(' \n '), /请先粘贴/);
  assert.throws(() => preparePaste('{"id":1}\n坏数据'), /第 2 行/);
  assert.throws(() => preparePaste('{"id":1,}'), /当前列表未更改/);
});
