import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_INDEX_CONFIG, indexKind, indexReferences, normalizeAliases, type IndexConfig } from '../src/indexReferences';
import { JsonTree } from '../src/JsonTree';
import { Highlight } from '../src/ui';

const config: IndexConfig = { aliases: normalizeAliases('round_index, round, index, 轮次, [xxx], msg.no'), bracketed: false };
const compact = (text: string, settings = config, kind?: 'message' | 'call') => indexReferences(text, settings, kind).map(r => [r.kind, r.index]);
test('默认不将round、index与普通数字作为轮次，原有识别不变', () => {
  for (const key of ['message_index', 'result_message_index', 'message_indices', 'tool_call链路']) assert.equal(indexKind(key), 'message');
  for (const key of ['round_index', 'round', 'index']) assert.equal(indexKind(key), undefined);
  assert.deepEqual(compact('round_index=4，[12]，普通索引8', DEFAULT_INDEX_CONFIG), []);
  assert.deepEqual(compact('message_index=4，call_index=[7, 8]', DEFAULT_INDEX_CONFIG), [['message', 4], ['call', 7], ['call', 8]]);
});
test('JSON键别名、大小写、调用索引始终优先', () => {
  for (const key of config.aliases) assert.equal(indexKind(key, config), 'message');
  assert.equal(indexKind('ROUND_INDEX', config), 'message');
  assert.equal(indexKind('call_index', { aliases: ['call_index'], bracketed: true }), 'call');
  assert.equal(indexKind('file_index', config), undefined);
});
test('结果文本别名与冒号等号、数组及数字字符串', () => {
  assert.deepEqual(compact('正文(round_index=4)，ROUND: 5；"index": [6, 7]；轮次：8；[xxx]=9；msg.no=10'), [
    ['message', 4], ['message', 5], ['message', 6], ['message', 7], ['message', 8], ['message', 9], ['message', 10],
  ]);
  assert.deepEqual(compact('[0, 2]', config, 'message'), [['message', 0], ['message', 2]]);
  assert.deepEqual(compact('4 → 5 -> 6', config, 'message'), [['message', 4], ['message', 5], ['message', 6]]);
  assert.deepEqual(compact('7', config, 'call'), [['call', 7]]);
});
test('负数、小数、科学计数、大整数、别名后缀不被截断识别', () => {
  for (const text of ['round_index=-1', 'round_index=1.2', 'round_index=1e3', 'round_index=9007199254740992', 'round_index=[1, -2]', 'round_index=[1, 2.3]', 'file_index=4', 'myround_index=5', 'msgXno=3', 'index=12abc']) assert.deepEqual(compact(text), [], text);
  for (const text of ['-1', '1.5', 'true', '第4轮共5页', '9007199254740992']) assert.deepEqual(compact(text, config, 'message'), [], text);
});
test('可选裸方括号引用、避免覆盖call_index数组语义', () => {
  assert.deepEqual(compact('见[4]及[5, 6]，call_index=[7,8]，round_index=[9,10]', { ...config, bracketed: true }), [
    ['message', 4], ['message', 5], ['message', 6], ['call', 7], ['call', 8], ['message', 9], ['message', 10],
  ]);
  assert.deepEqual(compact('见[xxx]、[-1]、[1.5]', { ...config, bracketed: true }), []);
});
test('配置规范化、正则标识按字面转义、保留call且限制长度', () => {
  assert.deepEqual(normalizeAliases('Round_Index，round_index\nmessage_index;轮次'), ['round_index', '轮次']);
  assert.throws(() => normalizeAliases('CALL_INDEX'), /保留/);
  assert.throws(() => normalizeAliases('x'.repeat(81)), /80/);
  assert.throws(() => normalizeAliases(Array.from({ length: 33 }, (_, i) => 'x' + i).join(',')), /32/);
  assert.deepEqual(compact('x.*=3', { aliases: ['x.*'], bracketed: false }), [['message', 3]]);
  assert.deepEqual(compact('xyz=3', { aliases: ['x.*'], bracketed: false }), []);
});
test('引用位置可还原数字，重复引用按原文顺序保留', () => {
  const text = '中文(round_index=4)；继续 round_index=4';
  const refs = indexReferences(text, config);
  assert.equal(refs.length, 2);
  for (const ref of refs) assert.equal(text.slice(ref.start, ref.end), '4');
  assert.ok(refs[1].start > refs[0].start);
});
test('JSON树字段与数组生成M按钮，call生成C按钮，搜索全局偏移不变', () => {
  const markup = renderToStaticMarkup(createElement(JsonTree, { value: { round_index: [4, 5], summary: '前文round_index=4 后文', call_index: 7 }, panel: 'result1', indexConfig: config,
    state: { depth: Infinity, overrides: {}, forced: new Set(), limits: {} }, query: '后文', focus: { token: 1, path: '/summary', offset: 16 }, jump: () => {}, onToggle: () => {}, onMore: () => {} }));
  assert.ok(markup.includes('M#4')); assert.ok(markup.includes('M#5')); assert.ok(markup.includes('C#7'));
  assert.ok(markup.includes('来源标识: round_index'));
  assert.ok(markup.includes('data-offset="16"')); assert.ok(markup.includes('active-hit'));
});
test('跨越插入按钮的搜索范围也保持高亮与全局偏移', () => {
  const text = '前round_index=4后', query = '4后';
  const left = renderToStaticMarkup(createElement(Highlight, { text, query, start: 0, end: 14, activeOffset: 13 }));
  const right = renderToStaticMarkup(createElement(Highlight, { text, query, start: 14, activeOffset: 13 }));
  assert.ok(left.includes('data-offset="13"')); assert.ok(right.includes('data-offset="13"'));
  assert.ok(left.includes('>4</mark>')); assert.ok(right.includes('>后</mark>'));
});
test('索引字段里的长文本继续按正文扫描，裸方括号引用不丢失', () => {
  const chain = 'Read[1] → 返回[未配对](状态未知) → Read[2] → Bash[10] → Edit[13] → Write[22]';
  assert.deepEqual(compact(chain, { ...config, bracketed: true }, 'message'), [['message', 1], ['message', 2], ['message', 10], ['message', 13], ['message', 22]]);
  assert.deepEqual(compact(chain, config, 'message'), [], '未启用裸方括号时不识别');
  assert.deepEqual(compact('4 → 5 -> 6', config, 'message'), [['message', 4], ['message', 5], ['message', 6]], '纯索引值语义不变');
  assert.deepEqual(compact('[4, 5]', config, 'message'), [['message', 4], ['message', 5]]);
  assert.deepEqual(compact('第4轮共5页', config, 'message'), []);
});
