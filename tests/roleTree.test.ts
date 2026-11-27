import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeTrace } from '../src/model';
import { roleOptions, visibleMessages } from '../src/roleFilter';
import { isNodeOpen, setBranch, withinBranch, type TreeState } from '../src/treeState';
import { JsonTree } from '../src/JsonTree';
import { RoleFilter } from '../src/RoleFilter.tsx';

const trace = normalizeTrace([
  { role: 'system', content: '系统' }, { role: 'user', content: '用户' },
  { role: 'assistant', content: '助手' }, { role: 'tool', content: '返回' },
  { from: 'human', value: '另一位用户' }, { role: 'custom', content: '自定义' },
]);
const state = (): TreeState => ({ depth: 1, overrides: {}, forced: new Set(), limits: {} });
test('默认全选、角色统计、human合并为USER，自定义角色保留', () => {
  assert.deepEqual(roleOptions(trace.messages), [{ role: 'system', count: 1 }, { role: 'user', count: 2 }, { role: 'assistant', count: 1 }, { role: 'tool', count: 1 }, { role: 'custom', count: 1 }]);
  assert.equal(visibleMessages(trace.messages, []).length, 6);
});
test('取消角色不改变原始消息位置或索引，全部取消为空', () => {
  const shown = visibleMessages(trace.messages, ['user', 'tool']);
  assert.deepEqual(shown.map(m => m.position), [0, 2, 5]);
  assert.deepEqual(shown.map(m => m.message.index), [0, 2, 5]);
  assert.equal(visibleMessages(trace.messages, roleOptions(trace.messages).map(r => r.role)).length, 0);
  assert.equal(visibleMessages(trace.messages, ['missing']).length, 6);
});
test('筛选按钮显示选中角色数，过滤保留消息对象与原始定位路径', () => {
  const markup = renderToStaticMarkup(createElement(RoleFilter, { roles: roleOptions(trace.messages), excluded: ['user', 'tool'], onChange: () => {} }));
  assert.ok(markup.includes('筛选轨迹角色')); assert.ok(markup.includes('3/5'));
  const filtered = visibleMessages(trace.messages, ['user', 'tool']);
  assert.equal(filtered[1].message, trace.messages[2]); assert.equal(filtered[1].message.path, '/2');
});
test('子树展开所有层级但不影响兄弟字段或修改输入状态', () => {
  const initial = state(), expanded = setBranch(initial, '/a', true);
  assert.equal(isNodeOpen(expanded, '/a', 1), true);
  assert.equal(isNodeOpen(expanded, '/a/deep/child', 3), true);
  assert.equal(isNodeOpen(expanded, '/b', 1), false);
  assert.equal(isNodeOpen(expanded, '/ab/child', 2), false);
  assert.equal(initial.branches, undefined);
});
test('子树收起清除范围内手动/强制展开，不影响旁边搜索及展开状态', () => {
  const initial: TreeState = { ...state(), depth: Infinity, overrides: { '/a/x': true, '/b/x': false }, forced: new Set(['', '/a', '/a/x', '/b/y']), branches: { '/a/x/y': true, '/b': true }, limits: { '/a': 180 } };
  const closed = setBranch(initial, '/a', false);
  assert.equal(isNodeOpen(closed, '/a', 1), false); assert.equal(isNodeOpen(closed, '/a/x', 2), false);
  assert.equal(isNodeOpen(closed, '/b/y', 2), true); assert.equal(isNodeOpen(closed, '/b/x', 2), false);
  assert.equal(closed.limits['/a'], 180); assert.ok(closed.forced.has(''));
  assert.ok(initial.forced.has('/a/x'));
});
test('子树展开后单独收起仍有效，再次全部展开清除子层级旧状态', () => {
  const opened = setBranch(state(), '/a', true); opened.overrides['/a/x'] = false;
  assert.equal(isNodeOpen(opened, '/a/x', 2), false);
  assert.equal(isNodeOpen(setBranch(opened, '/a', true), '/a/x', 2), true);
});
test('特殊JSON键按pointer边界操作，根节点操作覆盖全树', () => {
  assert.ok(withinBranch('/a~1b/~0x', '/a~1b')); assert.ok(!withinBranch('/a~1b2/x', '/a~1b'));
  const expanded = setBranch(state(), '', true);
  assert.equal(isNodeOpen(expanded, '/any/path', 5), true);
  assert.equal(isNodeOpen(setBranch(expanded, '', false), '', 0), false);
});
test('原始JSON与结果树复制旁显示局部按钮，展开后递归渲染，叶节点无按钮', () => {
  const markup = renderToStaticMarkup(createElement(JsonTree, { value: { a: { b: { c: '目标' } }, sibling: { x: 1 } }, panel: 'raw', state: setBranch(state(), '/a', true), query: '', jump: () => {}, onToggle: () => {}, onMore: () => {}, onBranch: () => {} }));
  assert.ok(markup.includes('展开 a 的全部子层级')); assert.ok(markup.includes('收起 a 的全部子层级'));
  assert.ok(markup.includes('data-path="/a/b/c"')); assert.ok(!markup.includes('data-path="/sibling/x"'));
  assert.ok(!markup.includes('展开 c 的全部子层级'));
});
