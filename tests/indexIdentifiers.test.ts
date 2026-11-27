import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_INDEX_CONFIG, indexKind, indexReferences } from '../src/indexReferences';
import { addIdentifiers, detectedIdentifiers, identifierNames, normalizeDisabled, removeIdentifier } from '../src/indexIdentifiers';
import { IndexSettingsDialog } from '../src/IndexSettings';
import { JsonTree } from '../src/JsonTree';

test('默认、当前记录内置名与自定义在同一个完整列表，去重', () => {
  const settings = addIdentifiers(DEFAULT_INDEX_CONFIG, 'ROUND_INDEX, round_index');
  const detected = detectedIdentifiers({ message_index: 1, nested: { result_message_index: 2, round_index: 3, call_index: 4 }, summary: 'message_indices=[1,2] round_index=4' }, settings);
  assert.deepEqual(new Set(detected), new Set(['message_index', 'result_message_index', 'round_index', 'message_indices']));
  assert.equal(identifierNames(settings, detected).filter(n => n === 'round_index').length, 1);
  assert.ok(!detected.includes('call_index'));
  assert.deepEqual(detectedIdentifiers({ round: 2, index: 3, round_index: 4 }, DEFAULT_INDEX_CONFIG), []);
});
test('内置名删除后JSON和文本停用，别的内置名称和call不受影响', () => {
  const disabled = removeIdentifier(DEFAULT_INDEX_CONFIG, 'message_index');
  assert.equal(indexKind('MESSAGE_INDEX', disabled), undefined);
  assert.equal(indexKind('result_message_index', disabled), 'message');
  assert.equal(indexKind('call_index', disabled), 'call');
  assert.deepEqual(indexReferences('message_index=[1,2];call_index=3;result_message_index=4', { ...disabled, bracketed: true }).map(r => [r.kind, r.index]), [['call', 3], ['message', 4]]);
  assert.deepEqual(identifierNames(disabled, ['message_index']), []);
});
test('自定义标识删除后可重加，规范化与去重，输入配置不可变', () => {
  const initial = addIdentifiers(DEFAULT_INDEX_CONFIG, 'round_index, 轮次');
  const removed = removeIdentifier(initial, 'ROUND_INDEX');
  assert.equal(indexKind('round_index', removed), undefined);
  const restored = addIdentifiers(removed, 'ROUND_INDEX, round_index');
  assert.equal(indexKind('round_index', restored), 'message');
  assert.deepEqual(restored.disabled, []);
  assert.equal(restored.aliases.filter(n => n === 'round_index').length, 1);
  assert.deepEqual(initial.aliases, ['round_index', '轮次']);
});
test('重新添加内置名取消排除，旧配置无disabled可直接读取', () => {
  const restored = addIdentifiers(removeIdentifier(DEFAULT_INDEX_CONFIG, 'message_index'), 'message_index');
  assert.equal(indexKind('message_index', restored), 'message');
  assert.deepEqual(restored.aliases, []);
  assert.deepEqual(normalizeDisabled(undefined), []);
  assert.deepEqual(normalizeDisabled(['MESSAGE_INDEX', ' message_index ', 3]), ['message_index']);
  assert.deepEqual(identifierNames(DEFAULT_INDEX_CONFIG), ['message_index']);
});
test('空名、call与超长别名被拒绝，删除列表不能抢占call语义', () => {
  assert.throws(() => addIdentifiers(DEFAULT_INDEX_CONFIG, ' , '), /请输入/);
  assert.throws(() => addIdentifiers(DEFAULT_INDEX_CONFIG, 'call_index'), /保留/);
  assert.throws(() => addIdentifiers(DEFAULT_INDEX_CONFIG, 'x'.repeat(81)), /80/);
  assert.equal(indexKind('call_index', { ...DEFAULT_INDEX_CONFIG, disabled: ['call_index'] }), 'call');
  assert.equal(indexReferences('call_index=4', { ...DEFAULT_INDEX_CONFIG, disabled: ['call_index'] })[0].kind, 'call');
});
test('弹窗完整名称与删除/补充按钮，停用名可恢复', () => {
  const settings = removeIdentifier(addIdentifiers(DEFAULT_INDEX_CONFIG, 'round_index'), 'message_index');
  const html = renderToStaticMarkup(createElement(IndexSettingsDialog, { settings, detected: ['result_message_index'], onApply: () => {}, onClose: () => {} }));
  assert.ok(html.includes('删除轮次标识 round_index'));
  assert.ok(html.includes('删除轮次标识 result_message_index'));
  assert.ok(html.includes('恢复轮次标识 message_index'));
  assert.ok(html.includes('补充其他标识名'));
  assert.ok(!html.includes('删除轮次标识 message_index'));
});
test('结果树禁用名不渲染M，新增名立即生成M，call仍生成C', () => {
  const settings = addIdentifiers(removeIdentifier(DEFAULT_INDEX_CONFIG, 'message_index'), 'round_index');
  const html = renderToStaticMarkup(createElement(JsonTree, { value: { message_index: 1, round_index: 2, call_index: 3, summary: 'message_index=4 round_index=5' }, panel: 'result1', indexConfig: settings,
    state: { depth: Infinity, overrides: {}, forced: new Set(), limits: {} }, query: '', jump: () => {}, onToggle: () => {}, onMore: () => {} }));
  assert.ok(!html.includes('M#1')); assert.ok(!html.includes('M#4'));
  assert.ok(html.includes('M#2')); assert.ok(html.includes('M#5')); assert.ok(html.includes('C#3'));
});
