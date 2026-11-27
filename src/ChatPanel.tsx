import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, MessagesSquare, X } from 'lucide-react';
import { offsets, type ChatMessage, type Normalized } from './model';
import { Content } from './Content';
import { ToolContent } from './ToolContent';
import { copyText, RoleBadge, scrollTarget, SearchBox, useDebounced, type FocusRequest, type Jump } from './ui';
import { RoleFilter } from './RoleFilter.tsx';
import { roleOptions, visibleMessages } from './roleFilter';

type Props = { trace: Normalized; source: string; recordId: string; globalQuery: string; request?: FocusRequest;
  onLocalSearch: () => void; onClose: () => void; jump: Jump; onOriginal: (path: string) => void;
  onPrevious: () => void; onNext: () => void; canPrevious: boolean; canNext: boolean; move: React.ReactNode;
  hiddenRoles: string[]; onRoles: (roles: string[]) => void };
export function ChatPanel(props: Props) {
  const { trace, source, globalQuery, request } = props;
  const [query, setQuery] = useState(''), [cursor, setCursor] = useState(-1), [rendered, setRendered] = useState(true);
  const [limit, setLimit] = useState(60), [collapsed, setCollapsed] = useState(false), [index, setIndex] = useState('');
  const [foldRevision, setFoldRevision] = useState(0);
  const [focus, setFocus] = useState<FocusRequest>();
  const roles = useMemo(() => roleOptions(trace.messages), [trace]);
  const shown = useMemo(() => visibleMessages(trace.messages, props.hiddenRoles), [trace, props.hiddenRoles]);
  const settled = useDebounced(query), effective = globalQuery || settled;
  const hits = useMemo(() => shown.flatMap(({ message, position }) => offsets(message.text, effective).map(offset => ({ message: position, offset }))), [shown, effective]);
  const scroll = useRef<HTMLDivElement>(null);
  const lastAutoQuery = useRef('');
  function reveal(target: FocusRequest) {
    const position = target.message ?? trace.messages.findIndex(m => m.index === target.index);
    if (position < 0 || position >= trace.messages.length) return;
    const ordinal = shown.findIndex(item => item.position === position);
    if (ordinal < 0) return;
    setFocus({ ...target, message: position }); setLimit(old => Math.max(old, ordinal + 1));
  }
  useEffect(() => { setCursor(-1); setFocus(undefined); }, [effective]);
  useEffect(() => { if (request) reveal(request); }, [request]);
  useEffect(() => { if (!focus) return; const timer = requestAnimationFrame(() => {
    const row = document.getElementById('trace-message-' + focus.message);
    const exact = row?.querySelector<HTMLElement>(`mark[data-offset="${focus.offset}"]`);
    scrollTarget(scroll.current, exact || row);
  }); return () => cancelAnimationFrame(timer); }, [focus, limit]);
  function moveHit(delta: number) {
    if (!hits.length) return;
    const next = cursor < 0 ? delta > 0 ? 0 : hits.length - 1 : (cursor + delta + hits.length) % hits.length;
    setCursor(next); reveal({ token: Date.now(), ...hits[next] });
  }
  useEffect(() => {
    const changed = lastAutoQuery.current !== effective; lastAutoQuery.current = effective;
    // 恢复隐藏角色会改变命中列表；显式轮次跳转优先，不被旧搜索的首个命中覆盖。
    if (effective && hits.length && !globalQuery && (!request || changed)) { setCursor(0); reveal({ token: Date.now(), ...hits[0] }); }
  }, [hits, effective]);
  const shownCursor = focus ? hits.findIndex(h => h.message === focus.message && h.offset === focus.offset) : cursor;
  function locate() { if (/^\d+$/.test(index.trim())) props.jump('message', Number(index)); }
  function changeRoles(excluded: string[]) { setFocus(undefined); setCursor(-1); setLimit(60); props.onRoles(excluded); }
  return <section className="panel chat-panel" data-panel="trace">
    <header className="panel-head"><div className="panel-title-group" title={`ID: ${props.recordId} · ${source} · ${trace.format} · USER 右 / ASSISTANT 左 · 原始索引不偏移`}><MessagesSquare size={16} /><h2>执行轨迹</h2><span className="pill">{shown.length === trace.messages.length ? `${shown.length} 条` : `${shown.length}/${trace.messages.length}`}</span></div>
      <div className="panel-head-controls trace-head-controls"><RoleFilter roles={roles} excluded={props.hiddenRoles} onChange={changeRoles} /><span className="panel-source" title={`ID: ${props.recordId} · ${source}`}>{props.recordId}</span><div className="index-locate"><input aria-label="message_index 定位" inputMode="numeric" value={index} placeholder="M# 定位" onChange={e => setIndex(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') locate(); }} /><button title="定位 message_index" onClick={locate} disabled={!/^\d+$/.test(index.trim())}>↗</button></div><div className="depth-tools"><button className={rendered ? 'selected' : ''} onClick={() => setRendered(true)}>对话</button><button className={!rendered ? 'selected' : ''} onClick={() => setRendered(false)}>原文</button><button onClick={() => { setCollapsed(true); setFoldRevision(v => v + 1); setFocus(undefined); }}>全收起</button><button onClick={() => { setCollapsed(false); setFoldRevision(v => v + 1); }}>全展开</button></div></div>
      <div className="flex items-center gap-1">{props.move}<button className="icon-button" title="上一条轨迹" aria-label="上一条轨迹" disabled={!props.canPrevious} onClick={props.onPrevious}><ArrowLeft size={15} /></button><button className="icon-button" title="下一条轨迹与结果" aria-label="下一条轨迹与结果" disabled={!props.canNext} onClick={props.onNext}><ArrowRight size={15} /></button><button className="icon-button" title="关闭轨迹栏" aria-label="关闭轨迹栏" onClick={props.onClose}><X size={15} /></button></div>
    </header>
    <div className="panel-tools"><SearchBox value={globalQuery || query} onChange={v => { props.onLocalSearch(); setQuery(v); }} count={hits.length} current={shownCursor} onMove={moveHit} label="搜索执行轨迹" pending={!globalQuery && query !== settled} /></div>
    <div ref={scroll} className="panel-scroll chat-scroll">
      {!!trace.warnings.length && <div className="notice">{trace.warnings.map(w => <p key={w}>{w}</p>)}</div>}
      {!trace.messages.length && <div className="empty-panel"><MessagesSquare size={30} /><p>没有可显示的消息，请更换轨迹字段。</p></div>}
      {!!trace.messages.length && !shown.length && <div className="empty-panel"><MessagesSquare size={30} /><p>当前所有角色已隐藏，请在标题栏“角色”中重新勾选。</p></div>}
      {shown.slice(0, limit).map(({ message, position }) => <MessageCard key={position} message={message} position={position} rendered={rendered} query={effective} active={focus?.message === position} offset={focus?.message === position ? focus.offset : -1} collapsed={collapsed} foldRevision={foldRevision} onOriginal={props.onOriginal} />)}
      {shown.length > limit && <button className="load-more" onClick={() => setLimit(Math.min(shown.length, limit + 60))}>继续显示 {Math.min(60, shown.length - limit)} 条消息 · 筛选后共 {shown.length} 条</button>}
      {focus && <div className="scroll-tail" aria-hidden="true" />}
    </div>
  </section>;
}
function MessageCard({ message, position, rendered, query, active, offset, collapsed, foldRevision, onOriginal }: {
  message: ChatMessage; position: number; rendered: boolean; query: string; active: boolean; offset?: number;
  collapsed: boolean; foldRevision: number; onOriginal: (path: string) => void;
}) {
  const [closed, setClosed] = useState(collapsed), [full, setFull] = useState(false), [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
  const [localRendered, setLocalRendered] = useState<boolean>();
  useEffect(() => setLocalRendered(undefined), [rendered]);
  const isRendered = localRendered ?? rendered;
  useEffect(() => setClosed(collapsed), [collapsed, foldRevision]);
  const show = active || !closed;
  const short = message.text.length > 12000 && !full && !active;
  const text = short ? message.text.slice(0, 12000) + '\n…' : message.text;
  async function copy() { const ok = await copyText(message.text); setCopied(ok); setCopyFailed(!ok); setTimeout(() => setCopied(false), 1600); }
  return <article id={'trace-message-' + position} data-message-index={message.index ?? undefined} className={`message-row ${message.role === 'user' ? 'user-row' : ''} ${active ? 'target-message' : ''}`}>
    <div className="message-meta"><RoleBadge role={message.role} /><span title={`原始角色: ${message.sourceRole}`}>{message.index === null ? '无原始索引' : `message_index: ${message.index}`}</span><span className="flex-1" />
      <button title="切换此条消息的渲染与原文" aria-label={`消息 ${message.index ?? position} 查看${isRendered ? '原文' : '渲染'}`} onClick={() => { setLocalRendered(!isRendered); setClosed(false); }}>{isRendered ? '查看原文' : '查看渲染'}</button><button title="定位原始 JSON" onClick={() => onOriginal(message.path)}>原始 ↗</button><button title="复制此条消息" aria-label={`复制消息 ${message.index ?? position}`} onClick={copy}>{copied ? <Check size={12} /> : <Copy size={12} />}</button><button onClick={() => setClosed(!closed)}>{show ? '收起' : '展开'}</button></div>
    <div className={`bubble ${message.role === 'user' ? 'user-bubble' : message.role === 'assistant' ? 'assistant-bubble' : message.role === 'tool' ? 'tool-bubble' : message.role === 'system' ? 'system-bubble' : ''}`}>
      {show ? <>{!isRendered && !query ? <pre className="message-original">{typeof message.raw === 'string' ? message.raw : JSON.stringify(message.raw, null, 2)}</pre> : isRendered && !query ? <ToolContent text={text || '（空消息）'} role={message.role} raw={message.raw} /> : <Content text={text || '（空消息）'} rendered={false} query={query} activeOffset={offset} />}
        {message.text.length > 12000 && <button className="text-link" onClick={() => setFull(!full)}>{short ? `展开完整 ${message.text.length.toLocaleString()} 字符` : '收起长消息'}</button>}
        {copyFailed && <p className="text-xs text-red-700 mt-2">浏览器不允许复制，请手动选中文本。</p>}
      </> : <button className="collapsed-preview" onClick={() => setClosed(false)}>{message.text.replace(/\s+/g, ' ').slice(0, 160) || '（空消息）'}</button>}
    </div>
  </article>;
}
