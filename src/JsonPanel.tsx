import { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, Check, Copy, Code, X } from 'lucide-react';
import { ancestors, childPath, jsonHits, nodeId, pathParts, type Json } from './model';
import { JsonTree, type RenderKind, type SummaryMode, type TreeState } from './JsonTree';
import { copyText, Highlight, scrollTarget, SearchBox, useDebounced, type FocusRequest, type Jump } from './ui';
import { setBranch, withinBranch } from './treeState';

type Props = { id: string; title: string; value: Json; source: string; rawText?: string; globalQuery: string;
  request?: FocusRequest; jump: Jump; onLocalSearch: () => void; onRender?: (kind: RenderKind, path: string) => void;
  onClose?: () => void; move?: React.ReactNode; missing?: string; summary?: SummaryMode; onSummary?: (mode: SummaryMode) => void };
export function JsonPanel({ id, title, value, source, rawText, globalQuery, request, jump, onLocalSearch, onRender, onClose, move, missing, summary = 'always', onSummary }: Props) {
  const [query, setQuery] = useState(''), [current, setCurrent] = useState(-1);
  const settled = useDebounced(query), effective = globalQuery || settled;
  const hits = useMemo(() => jsonHits(value, effective), [value, effective]);
  const [state, setState] = useState<TreeState>({ depth: 1, overrides: {}, forced: new Set(), limits: {} });
  const [focus, setFocus] = useState<FocusRequest>(), [textView, setTextView] = useState(false);
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  function reveal(target: FocusRequest) {
    setTextView(false); setFocus(target);
    const path = target.path ?? '', force = [...ancestors(path), path];
    const limits: Record<string, number> = {};
    let p = '';
    for (const part of pathParts(path)) {
      const parent = p; p = childPath(p, part);
      const parentValue = pathParts(parent).reduce((v, k) => v?.[k], value);
      if (parentValue && typeof parentValue === 'object') {
        const index = Object.keys(parentValue).indexOf(part);
        if (index >= 0) limits[parent] = index + 1;
      }
    }
    setState(old => ({ ...old, forced: new Set(force), limits: Object.fromEntries([...Object.entries(old.limits), ...Object.entries(limits).map(([p, n]) => [p, Math.max(old.limits[p] || 80, n)])]) }));
  }
  useEffect(() => { setCurrent(-1); setFocus(undefined); }, [effective]);
  useEffect(() => { if (request) reveal(request); }, [request]);
  useEffect(() => {
    if (!focus) return;
    const timer = requestAnimationFrame(() => {
      const row = document.getElementById(nodeId(id, focus.path || ''));
      const exact = row?.querySelector<HTMLElement>(`mark[data-offset="${focus.offset}"][data-kind="${focus.kind || 'value'}"]`);
      scrollTarget(scroll.current, exact || row);
    });
    return () => cancelAnimationFrame(timer);
  }, [focus, state, id, textView]);
  function moveHit(delta: number) {
    if (!hits.length) return;
    const next = current < 0 ? delta > 0 ? 0 : hits.length - 1 : (current + delta + hits.length) % hits.length;
    setCurrent(next); reveal({ token: Date.now(), ...hits[next] });
  }
  useEffect(() => { if (effective && hits.length && !globalQuery) { setCurrent(0); reveal({ token: Date.now(), ...hits[0] }); } }, [effective, hits]);
  const shownCursor = focus ? hits.findIndex(h => h.path === focus.path && h.kind === focus.kind && h.offset === focus.offset) : current;
  function changeDepth(depth: number) { setState({ depth, overrides: {}, forced: new Set(), limits: {} }); setFocus(undefined); }
  function changeBranch(path: string, open: boolean) { setState(old => setBranch(old, path, open)); if (focus && withinBranch(focus.path || '', path)) setFocus(undefined); }
  async function copy() { const ok = await copyText(rawText ?? JSON.stringify(value, null, 2)); setCopied(ok); setCopyError(ok ? '' : '浏览器不允许复制，请选中文本手动复制。'); setTimeout(() => setCopied(false), 1600); }
  return <section className={`panel ${id === 'raw' ? 'raw-panel' : 'result-panel'}`} data-panel={id}>
    <header className="panel-head">
      <div className="panel-title-group" title={`${source} · 独立滚动 · M 蓝色定位轨迹 / C 紫色定位调用记录`}><Braces size={16} /><h2>{title}</h2></div>
      <div className="depth-tools panel-head-controls" aria-label={`${title}显示设置`}>{[0, 1, 2, 3, 4, Infinity].map(d => <button key={d} className={state.depth === d && !textView ? 'selected' : ''} onClick={() => { setTextView(false); changeDepth(d); }} title={d === Infinity ? '所有层级展开，大数组分批加载' : undefined}>{d === 0 ? '收起' : d === Infinity ? '全部' : `${d}层`}</button>)}<button className={textView ? 'selected' : ''} onClick={() => setTextView(!textView)} title="JSON 文本／结构树切换"><Code size={12} />原文</button>{onSummary && <span className="summary-group" title="控制「{ N 个字段 }」「[ N 项 ]」这类数量提示在什么时候出现"><span className="summary-label">数量提示</span><select className="summary-select" value={summary} aria-label="数量提示的显示时机" onChange={e => onSummary(e.target.value as SummaryMode)}><option value="always">始终显示</option><option value="collapsed">折叠时才显示</option><option value="never">不显示</option></select></span>}</div>
      <div className="flex items-center gap-1 shrink-0">{move}<button className="icon-button" onClick={copy} title="复制完整 JSON" aria-label={`复制${title}`}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>{onClose && <button className="icon-button" title="关闭此栏" aria-label={`关闭${title}`} onClick={onClose}><X size={15} /></button>}</div>
    </header>
    <div className="panel-tools"><SearchBox value={globalQuery || query} onChange={v => { onLocalSearch(); setQuery(v); }} count={hits.length} current={shownCursor} onMove={moveHit} label={`搜索${title}`} pending={!globalQuery && query !== settled} /></div>
    <div ref={scroll} className="panel-scroll json-scroll">
      {copyError && <div className="notice">{copyError}</div>}
      {missing || value === undefined ? <div className="empty-panel"><Braces size={30} /><p>{missing || '当前记录没有这个字段。请在顶部选择其他字段。'}</p>{rawText && <pre className="plain-text text-red-700">{rawText}</pre>}</div> : textView ? <pre className="raw-pre"><Highlight text={rawText ?? JSON.stringify(value, null, 2)} query={effective} /></pre> : <JsonTree value={value} panel={id} state={state} query={effective} focus={focus} jump={jump} onRender={onRender} onBranch={changeBranch}
        onToggle={(p, open) => setState(old => ({ ...old, overrides: { ...old.overrides, [p]: open }, forced: new Set([...old.forced].filter(v => v !== p)) }))}
        onMore={(p, count) => setState(old => ({ ...old, limits: { ...old.limits, [p]: count } }))} summary={summary} />}
      {focus && <div className="scroll-tail" aria-hidden="true" />}
    </div>
  </section>;
}
