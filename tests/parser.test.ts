import test from 'node:test';
import assert from 'node:assert/strict';
import { fileFormat, indexFile } from '../src/parser.worker';
import { parseLine } from '../src/model';

test('UTF-8 byte offsets, BOM, CRLF, blank and invalid lines, no trailing newline', async () => {
  const text = '\uFEFF{"id":"中文一","messages":[]}\r\n\r\nnot-json\n{"id":"中文二","inputs":"问题"}';
  const file = new Blob([text]); const out = await indexFile(file);
  assert.equal(out.rows.length, 3); assert.equal(out.blanks, 1); assert.equal(out.rows[0].line, 1); assert.equal(out.rows[1].line, 3); assert.ok(out.rows[1].error); assert.equal(out.rows[2].line, 4);
  assert.equal(parseLine(await file.slice(out.rows[2].start, out.rows[2].end).text()).id, '中文二');
  assert.equal(out.rows[2].end, new TextEncoder().encode(text).length); assert.ok(out.fields.includes('/messages'));
});
test('long lines spanning stream chunks do not split Chinese codepoints', async () => {
  const row = { id: 'long', messages: [{ role: 'user', content: '中文与emoji🌳'.repeat(16000) }] };
  const file = new Blob([JSON.stringify(row) + '\n' + JSON.stringify({ id: 'second' }) + '\n']);
  const out = await indexFile(file); assert.equal(out.rows.length, 2); assert.equal(out.rows[0].error, undefined);
  assert.deepEqual(parseLine(await file.slice(out.rows[0].start, out.rows[0].end).text()), row);
});
test('duplicate IDs preserved, primitives accepted, empty file handled', async () => {
  assert.equal((await indexFile(new Blob(['\n \n']))).rows.length, 0);
  const out = await indexFile(new Blob(['{"id":"same"}\n{"id":"same"}\nnull\n42\n"text"']));
  assert.equal(out.rows.length, 5); assert.equal(out.rows[0].id, out.rows[1].id); assert.ok(out.rows.every(r => !r.error));
});
test('invalid UTF-8 is an explicit error, not silently altered', async () => {
  const out = await indexFile(new Blob([new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])]));
  assert.equal(out.rows.length, 1); assert.ok(out.rows[0].error);
});
test('JSON multiline object is exactly one record with complete original bytes', async () => {
  const value = { id: '单条', messages: [{ role: 'user', content: '中文🌳' }], result: { success: true } };
  const file = new Blob(['\uFEFF' + JSON.stringify(value, null, 2)]);
  const out = await indexFile(file, undefined, 'json');
  assert.equal(out.rows.length, 1); assert.equal(out.rows[0].id, '单条'); assert.ok(out.fields.includes('/result'));
  assert.deepEqual(parseLine(await file.slice(out.rows[0].start, out.rows[0].end).text()), value);
});
test('JSON array root remains one record, not silently split', async () => {
  const value = [{ id: 'a' }, { id: 'b' }], file = new Blob([JSON.stringify(value, null, 2)]);
  const out = await indexFile(file, undefined, 'json'); assert.equal(out.rows.length, 1);
  assert.deepEqual(parseLine(await file.slice(out.rows[0].start, out.rows[0].end).text()), value);
});
test('malformed JSON retains one error record; empty JSON has none', async () => {
  const out = await indexFile(new Blob(['{\n"id": invalid\n}']), undefined, 'json');
  assert.equal(out.rows.length, 1); assert.ok(out.rows[0].error);
  assert.equal((await indexFile(new Blob(['   ']), undefined, 'json')).rows.length, 0);
});
test('file extension distinguishes JSON from JSONL and NDJSON', () => {
  assert.equal(fileFormat('TEST.JSON'), 'json'); assert.equal(fileFormat('test.jsonl'), 'jsonl'); assert.equal(fileFormat('test.ndjson'), 'jsonl');
});
