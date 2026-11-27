import { ChevronDown, ChevronRight, MessagesSquare, Braces, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Fragment, useContext, useState } from 'react';
import { childPath, nodeId, pathParts, roleName, type Json } from './model';
import { Highlight, RoleBadge, type FocusRequest, type Jump } from './ui';
import { FieldCopy } from './FieldCopy';
import { MessageIndexContext } from './IndexSettings';
import { indexKind, indexReferences, type IndexConfig } from './indexReferences';
import { isNodeOpen, type TreeState } from './treeState';
export { indexKind } from './indexReferences';
export type { TreeState } from './treeState';

export type RenderKind = 'trace' | 'result1' | 'result2';
export type SummaryMode = 'always' | 'collapsed' | 'never';
type Props = { value: Json; panel: string; state: TreeState; onToggle: (path: string, open: boolean) => void;
  onMore: (path: string, count: number) => void; query: string; focus?: FocusRequest; jump: Jump;
  onRender?: (kind: RenderKind, path: string) => void; basePath?: string; indexConfig?: IndexConfig;
  onBranch?: (path: string, open: boolean) => void; summary?: SummaryMode };

function IndexButton({ kind, index, label, jump }: { kind: 'message' | 'call'; index: number; label: string; jump: Jump }) {
  return <button className={`index-link ${kind}`} title={`定位 ${kind === 'message' ? 'message_index' : 'call_index'} = ${index}${label !== (kind === 'message' ? 'message_index' : 'call_index') ? ` · 来源标识: ${label}` : ''}`} onClick={() => jump(kind, index)}>{kind === 'message' ? 'M' : 'C'}#{index} ↗</button>;
}
function TextValue({ value, query, activeOffset, kind, jump, indexConfig }: { value: Json; query: string; activeOffset: number; kind?: 'message' | 'call'; jump: Jump; indexConfig?: IndexConfig }) {
  const text = typeof value === 'string' ? value : value === undefined ? 'undefined' : JSON.stringify(value);
  const refs = typeof value === 'string' || typeof value === 'number' ? indexReferences(text, indexConfig, kind) : [];
  // 就地放置跳转按钮，长段总结中不必到段尾寻找引用；完整原文仍用于复制。
  let start = 0;
  return <span className={`json-value ${value === null ? 'null' : typeof value}`}>
    {refs.slice(0, 100).map((ref, i) => { const from = start; start = ref.end; return <Fragment key={i}><Highlight text={text} start={from} end={ref.end} query={query} activeOffset={activeOffset} /><IndexButton {...ref} jump={jump} /></Fragment>; })}
    <Highlight text={text} start={start} query={query} activeOffset={activeOffset} />
    {refs.length > 100 && <span className="text-slate-500">其余索引请查看原文</span>}
  </span>;
}
export function JsonTree(props: Props) { const config = useContext(MessageIndexContext); return <Node {...props} indexConfig={props.indexConfig ?? config} path="" label="$" level={0} />; }
function Node(props: Props & { path: string; label: string; level: number; inheritedKind?: 'message' | 'call' }) {
  const { value, panel, state, path, label, level, query, focus, inheritedKind, jump } = props;
  const [full, setFull] = useState(false);
  const complex = value !== null && typeof value === 'object';
  const keys = complex ? Object.keys(value) : [];
  const open = isNodeOpen(state, path, level);
  const active = focus?.path === path;
  const kind = indexKind(label, props.indexConfig) || inheritedKind;
  const role = complex && !Array.isArray(value) ? value.role ?? value.from ?? value.message?.role ?? value.author?.role : undefined;
  const rawText = typeof value === 'string' ? value : '';
  const short = rawText.length > 600 && !full && !active;
  const limit = state.limits[path] ?? 80;
  const absolute = (props.basePath || '') + path;
  return <div className="json-node">
    <div id={nodeId(panel, path)} data-path={path} className={`json-line ${active ? 'target-node' : ''}`}>
      {complex && keys.length ? <button className="tree-toggle" onClick={() => props.onToggle(path, !open)} aria-label={`${open ? '收起' : '展开'} ${label}`} aria-expanded={open}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button> : <span className="tree-toggle" />}
      <span className="json-key"><Highlight text={label} query={query} kind="key" activeOffset={active && focus?.kind === 'key' ? focus.offset : -1} /></span><span className="text-slate-400 mr-2">:</span>
      {complex ? <>
        {(props.summary ?? 'always') !== 'never' && ((props.summary ?? 'always') === 'always' || !open) && <span className="json-summary" onDoubleClick={() => props.onToggle(path, !open)}>{Array.isArray(value) ? `[ ${keys.length} 项 ]` : `{ ${keys.length} 个字段 }`}</span>}
        {role !== undefined && <RoleBadge role={roleName(role)} />}
        {value?.call_index !== undefined && !Array.isArray(value) && <span className="call-tag">call_index: {String(value.call_index).slice(0, 40)}</span>}
      </> : <>
        <TextValue value={short ? rawText.slice(0, 600) + '…' : value} query={query} activeOffset={active && focus?.kind !== 'key' ? focus?.offset ?? -1 : -1} kind={kind} jump={jump} indexConfig={props.indexConfig} />
        {rawText.length > 600 && <button className="text-link" onClick={() => setFull(!full)}>{short ? `展开 ${rawText.length.toLocaleString()} 字符` : '收起长文本'}</button>}
      </>}
      <span className="node-actions"><FieldCopy value={value} label={label} />
        {complex && keys.length > 0 && props.onBranch && <><button className="branch-action" aria-label={`展开 ${label} 的全部子层级`} title="展开当前字段全部子层级，大数组分批加载" onClick={() => props.onBranch!(path, true)}><ChevronsUpDown size={12} />展开全部</button><button className="branch-action" aria-label={`收起 ${label} 的全部子层级`} title="收起当前字段及其全部子层级" onClick={() => props.onBranch!(path, false)}><ChevronsDownUp size={12} />收起全部</button></>}
        {props.onRender && path && <><button title="将此字段渲染为轨迹" onClick={() => props.onRender!('trace', absolute)}><MessagesSquare size={12} />轨迹</button>
        <button title="将此字段渲染为结果 1" onClick={() => props.onRender!('result1', absolute)}><Braces size={12} />结果1</button>
        <button title="将此字段渲染为结果 2" onClick={() => props.onRender!('result2', absolute)}>结果2</button></>}
      </span>
    </div>
    {complex && open && !!keys.length && <div className="json-children">
      {keys.slice(0, limit).map(key => <Fragment key={key}><Node {...props} value={value[key]} path={childPath(path, key)} label={key} level={level + 1}
        inheritedKind={Array.isArray(value) ? kind : undefined} /></Fragment>)}
      {keys.length > limit && <button className="load-more" onClick={() => props.onMore(path, Math.min(keys.length, limit + 100))}>继续加载 {Math.min(100, keys.length - limit)} 项 · 尚有 {keys.length - limit} 项</button>}
    </div>}
  </div>;
}
