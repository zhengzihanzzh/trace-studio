import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileJson, HelpCircle, LockKeyhole, PanelLeftOpen, RotateCcw, Upload, X, Moon, Sun, ClipboardPaste } from 'lucide-react';
import { inferFields, NONE, normalizeTrace, offsets, jsonHits, valueAt, pathLabel, resultJson } from './model';
import { callTargets } from './callTargets';
import { useDataset } from './useDataset';
import { ImportChoice } from './ImportChoice';
import { ResizablePanels } from './ResizablePanels';
import { Sidebar } from './Sidebar';
import { Controls, MoveButtons, titles, type Config, type Visible } from './Controls';
import { JsonPanel } from './JsonPanel';
import { ChatPanel } from './ChatPanel';
import { Welcome } from './Welcome';
import { SearchBox, useDebounced, type FocusRequest, type Jump } from './ui';
import { demoFile } from './demo';
import type { RenderKind } from './JsonTree';
import { MessageIndexContext, IndexSettingsDialog, useIndexSettings } from './IndexSettings';
import { PasteDialog } from './PasteDialog';
import { useTheme } from './useTheme';
import { visibleMessages } from './roleFilter';
import { detectedIdentifiers, identifierNames } from './indexIdentifiers';

const emptyConfig: Config = { trace: NONE, result1: NONE, result2: NONE };
const hidden: Visible = { trace: false, result1: false, result2: false };
export default function App() {
  const data = useDataset();
  const indexSettings = useIndexSettings(), [indexDialog, setIndexDialog] = useState(false);
  const theme = useTheme();
  const [hiddenRoles, setHiddenRoles] = useState<string[]>([]);
  const [config, setConfig] = useState<Config>(emptyConfig), [visible, setVisible] = useState<Visible>(hidden);
  const [order, setOrder] = useState<RenderKind[]>(['trace', 'result1', 'result2']), [sidebar, setSidebar] = useState(true), [rawOn, setRawOn] = useState(true);
  const [globalInput, setGlobalInput] = useState(''), [globalCursor, setGlobalCursor] = useState(-1);
  const globalQuery = useDebounced(globalInput);
  const [requests, setRequests] = useState<Record<string, FocusRequest>>({});
  const [toast, setToast] = useState(''), [paste, setPaste] = useState(false), [help, setHelp] = useState(false);
  const [dragging, setDragging] = useState(false), [idSearch, setIdSearch] = useState(''), [summaryMode, setSummaryMode] = useState<'always' | 'collapsed' | 'never'>(() => { try { const v = localStorage.getItem('trace-studio.summary'); return v === 'never' || v === 'collapsed' ? v : 'always'; } catch { return 'always'; } });
  useEffect(() => { try { localStorage.setItem('trace-studio.summary', summaryMode); } catch { /* 存储不可用时仅本会话生效 */ } }, [summaryMode]);
  const [pendingFile, setPendingFile] = useState<File>(), [widthReset, setWidthReset] = useState(0);
  const input = useRef<HTMLInputElement>(null), configured = useRef<File | null>(null), token = useRef(0);
  const autoDemo = useRef(false);
  const dragDepth = useRef(0);
  const row = data.rows[data.selected], hasData = data.rows.length > 0;
  const trace = useMemo(() => normalizeTrace(valueAt(data.record, config.trace), config.trace), [data.record, config.trace]);
  const values = useMemo(() => ({ result1: resultJson(valueAt(data.record, config.result1)), result2: resultJson(valueAt(data.record, config.result2)) }), [data.record, config]);
  const detectedNames = useMemo(() => detectedIdentifiers([data.record, values.result1, values.result2], indexSettings.settings), [data.record, values, indexSettings.settings]);
  const activeNames = identifierNames(indexSettings.settings, detectedNames);
  const globalHits = useMemo(() => {
    if (!globalQuery || data.record === undefined) return [];
    const hits: (FocusRequest & { panel: string })[] = jsonHits(data.record, globalQuery).map(h => ({ ...h, panel: 'raw', token: 0 }));
    for (const kind of order) {
      if (!visible[kind]) continue;
      if (kind === 'trace') visibleMessages(trace.messages, hiddenRoles).forEach(({ message: m, position: message }) => offsets(m.text, globalQuery).forEach(offset => hits.push({ panel: kind, message, offset, token: 0 })));
      else for (const h of jsonHits(values[kind], globalQuery)) hits.push({ ...h, panel: kind, token: 0 });
    }
    return hits;
  }, [data.record, globalQuery, order, visible, trace, values, hiddenRoles]);
  const idMatches = useMemo(() => idSearch.trim() ? data.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.id.toLowerCase().includes(idSearch.trim().toLowerCase())).slice(0, 50) : [], [idSearch, data.rows]);
  useEffect(() => {
    if (data.record === undefined || configured.current === data.file) return;
    configured.current = data.file;
    if (autoDemo.current) { setConfig({ ...inferFields(data.record), result2: '/tool_call_records' }); setVisible({ trace: true, result1: true, result2: true }); autoDemo.current = false; }
    else { setConfig(inferFields(data.record)); setVisible(hidden); }
    setRequests({}); setGlobalInput(''); setIdSearch(''); setHiddenRoles([]);
  }, [data.record, data.file]);
  useEffect(() => { if (new URL(location.href).searchParams.get('demo') === '1') { autoDemo.current = true; load(demoFile()); } }, []);
  useEffect(() => { setGlobalCursor(-1); setRequests({}); }, [globalQuery, data.selected]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  function load(file: File) {
    if (data.progress) { setToast('正在导入文件，请完成或取消后再打开新文件。'); return; }
    setPaste(false);
    if (data.rows.length) setPendingFile(file); else data.load(file);
  }
  function field(kind: RenderKind, path: string) { setConfig(old => ({ ...old, [kind]: path })); setRequests({}); if (kind === 'trace') setHiddenRoles([]); if (path === NONE) setVisible(old => ({ ...old, [kind]: false })); }
  function render(kind: RenderKind, path: string) { field(kind, path); setVisible(old => ({ ...old, [kind]: true })); }
  function select(index: number) { if (index >= 0 && index < data.rows.length) { data.select(index); setRequests({}); setIdSearch(''); setHiddenRoles([]); } }
  function request(panel: string, target: FocusRequest) { setRequests(old => ({ ...old, [panel]: { ...target, token: ++token.current } })); }
  const jump: Jump = (kind, index) => {
    if (kind === 'message') {
      const message = trace.messages.find(m => m.index === index);
      if (!message) { setToast(`当前轨迹字段未找到 message_index=${index}。请检查字段配置；索引按原始数组从 0 开始，不自动偏移。`); return; }
      if (hiddenRoles.includes(message.role)) { setHiddenRoles(old => old.filter(role => role !== message.role)); setToast(`定位目标属于隐藏的 ${message.role.toUpperCase()} 角色，已恢复显示该角色。`); }
      setVisible(old => ({ ...old, trace: true })); request('trace', { index, token: 0 });
    } else {
      const unique = callTargets(config, values, index);
      if (!unique.length) { setToast(`已配置的结果字段中未找到 call_index=${index}。可以把 tool_call 记录字段配置为结果 2 后重试。`); return; }
      if (unique.length > 1) { setToast(`找到 ${unique.length} 个 call_index=${index}，无法唯一定位。请将调用记录字段单独配置到一个结果栏。`); return; }
      setVisible(old => ({ ...old, [unique[0].panel]: true })); request(unique[0].panel, { path: unique[0].path, token: 0 });
    }
  };
  function move(kind: RenderKind, delta: number) { setOrder(old => { const next = [...old], shown = old.filter(k => visible[k]), neighbor = shown[shown.indexOf(kind) + delta]; if (neighbor) { const at = next.indexOf(kind), to = next.indexOf(neighbor); [next[at], next[to]] = [next[to], next[at]]; } return next; }); }
  function moveGlobal(delta: number) {
    if (!globalHits.length) return;
    const next = globalCursor < 0 ? delta > 0 ? 0 : globalHits.length - 1 : (globalCursor + delta + globalHits.length) % globalHits.length;
    setGlobalCursor(next); const hit = globalHits[next]; request(hit.panel, hit);
  }
  const activeOrder = order.filter(k => visible[k]);
  function fileFromDrop(e: React.DragEvent) {
    e.preventDefault(); dragDepth.current = 0; setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 1) { setToast('一次请选择一个 JSON 或 JSONL 文件，可逐次追加。'); return; }
    if (files[0]) load(files[0]);
  }
  return <MessageIndexContext.Provider value={indexSettings.settings}><div className="app" onDragEnter={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragging(true); } }} onDragOver={e => e.preventDefault()} onDragLeave={() => { if (--dragDepth.current <= 0) setDragging(false); }} onDrop={fileFromDrop}>
    <input ref={input} className="sr-only" id="file-upload" type="file" accept=".jsonl,.ndjson,.json,.txt" onChange={e => { if (e.target.files?.[0]) load(e.target.files[0]); e.target.value = ''; }} />
    <header className={`topbar ${hasData ? 'has-data' : ''}`}><div className="brand" title="Trace Studio V1.6 · 通用 JSON / JSONL 轨迹预览"><div className="brand-icon"><FileJson size={22} strokeWidth={1.7} /></div><div><strong>Trace Studio</strong><span>通用 JSON / JSONL 轨迹预览</span></div><span className="version">V1.6</span></div>
      {hasData && <div className="record-tools" aria-label="选题与导航">
        <button className="icon-button" onClick={() => setSidebar(!sidebar)} title={sidebar ? '收起选题导航' : '展开选题导航'} aria-label={sidebar ? '收起选题导航' : '展开选题导航'}><PanelLeftOpen size={16} /></button><button className="icon-button raw-toggle" onClick={() => setRawOn(!rawOn)} title={rawOn ? '收起原始 JSON 栏' : '展开原始 JSON 栏'} aria-label={rawOn ? '收起原始 JSON 栏' : '展开原始 JSON 栏'} aria-pressed={rawOn}><FileJson size={16} style={rawOn ? undefined : { opacity: .45 }} /></button>
        <span className="file-summary" title={`${data.files.map(f => f.name).join('\n')}\n共 ${data.rows.length} 条${data.rows.some(r => r.error) ? ` · ${data.rows.filter(r => r.error).length} 条异常` : ''}${data.blanks > 0 ? ` · 忽略 ${data.blanks} 个空行` : ''}`}><FileJson size={13} /><span>{data.rows.length.toLocaleString()} 条</span></span>
        <button className="icon-button" aria-label="重置列宽" title="重置列宽" onClick={() => setWidthReset(v => v + 1)}><RotateCcw size={14} /></button>
        <div className="record-picker"><input aria-label="输入 ID 切换轨迹" placeholder="输入 ID 切题…" value={idSearch} onChange={e => setIdSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && idMatches.length === 1) select(idMatches[0].i); if (e.key === 'Escape') setIdSearch(''); }} />{idSearch && <div className="id-menu">{!idMatches.length ? <p>没有匹配 ID</p> : <><p>{idMatches.length >= 50 ? '前 50 个匹配' : `${idMatches.length} 个匹配`}</p>{idMatches.map(({ r, i }) => <button key={i} onClick={() => select(i)}><span>{r.id}</span><small>第 {r.line} 行</small></button>)}</>}</div>}</div>
        <div className="record-step"><button className="icon-button" aria-label="上一条记录" disabled={!data.selected} onClick={() => select(data.selected - 1)}><ArrowLeft size={15} /></button><span className="record-total">{data.selected + 1}/{data.rows.length}</span><button className="icon-button" aria-label="下一条记录" disabled={data.selected >= data.rows.length - 1} onClick={() => select(data.selected + 1)}><ArrowRight size={15} /></button></div>
      </div>}
      {hasData && <Controls fields={data.fields} config={config} visible={visible} onField={field} onVisible={k => setVisible(old => ({ ...old, [k]: !old[k] }))} onIndexSettings={() => setIndexDialog(true)} indexAliasCount={Math.max(0, activeNames.length - 1) + Number(indexSettings.settings.bracketed)} indexAliasSummary={[...activeNames, ...(indexSettings.settings.bracketed ? ['[数字]'] : [])].join(', ') || '未启用 · 点击添加'} />}
      {hasData && <div className="global-search" role="search" aria-label="整体搜索区"><span className="global-search-title" title="搜索当前题所有已显示分栏">整体搜索</span><SearchBox value={globalInput} onChange={v => { setGlobalInput(v); setGlobalCursor(-1); }} count={globalHits.length} current={globalCursor} onMove={moveGlobal} label="整体搜索 · 当前题所有已显示区域" pending={globalInput !== globalQuery} /></div>}
      <div className="top-actions"><span className="local-badge" title="文件仅在浏览器内解析，不上传服务器；关闭或刷新后需重新打开文件"><LockKeyhole size={13} /><span>浏览器本地处理</span></span><button className="icon-button theme-button" title={theme.theme === 'light' ? '切换夜间模式' : '切换日间模式'} aria-label={theme.theme === 'light' ? '切换夜间模式' : '切换日间模式'} onClick={theme.toggle}>{theme.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="icon-button" title="使用说明" aria-label="使用说明" onClick={() => setHelp(true)}><HelpCircle size={18} /></button><button className="secondary-button compact" title="直接粘贴 JSON / JSONL，可替换或追加" aria-label="粘贴数据" disabled={!!data.progress} onClick={() => setPaste(true)}><ClipboardPaste size={14} /><span>粘贴</span></button>{hasData && <button className="secondary-button compact" title="打开 JSON / JSONL，可替换或追加" aria-label="打开文件" onClick={() => input.current?.click()}><Upload size={14} /><span>打开</span></button>}</div>
    </header>
    {!hasData ? <Welcome choose={() => input.current?.click()} onDemo={() => load(demoFile())} onPaste={() => setPaste(true)} busy={!!data.progress} progress={data.progress && data.parsingFile?.size ? data.progress.loaded / data.parsingFile.size * 100 : 0} count={data.progress?.count || 0} onCancel={data.cancel} error={data.error} /> : <>
      {data.progress && <div className="import-progress" role="status">正在导入 {data.parsingFile?.name} · {Math.round(data.progress.loaded / Math.max(1, data.parsingFile?.size || 1) * 100)}% · {data.progress.count} 条<button onClick={data.cancel}>取消导入</button></div>}
      {data.error && <div className="import-progress" role="alert">{data.error}</div>}
      <div className="workspace">{sidebar && <Sidebar rows={data.rows} selected={data.selected} onSelect={select} onCollapse={() => setSidebar(false)} />}
        <ResizablePanels reset={widthReset} signature={(rawOn ? 'raw|' : '|') + activeOrder.join(',')}>
          {rawOn && <JsonPanel key={`raw-${data.selected}`} id="raw" title="原始 JSON" source={row?.id || ''} value={data.record} rawText={data.raw} globalQuery={globalQuery} request={requests.raw} jump={jump} onLocalSearch={() => setGlobalInput('')} onRender={render} onClose={() => setRawOn(false)} summary={summaryMode} onSummary={setSummaryMode} missing={row?.error ? `第 ${row.line} 行无法解析：${row.error}` : undefined} />}
          {activeOrder.map(kind => kind === 'trace' ? <ChatPanel key={`trace-${data.selected}-${config.trace}`} trace={trace} source={pathLabel(config.trace)} recordId={row?.id || ''} globalQuery={globalQuery} request={requests.trace} jump={jump} onLocalSearch={() => setGlobalInput('')} onClose={() => setVisible(old => ({ ...old, trace: false }))} onOriginal={path => { setRawOn(true); request('raw', { path, token: 0 }); }} hiddenRoles={hiddenRoles} onRoles={roles => { setHiddenRoles(roles); setRequests({}); setGlobalCursor(-1); }} onPrevious={() => select(data.selected - 1)} onNext={() => select(data.selected + 1)} canPrevious={data.selected > 0} canNext={data.selected < data.rows.length - 1} move={<MoveButtons kind={kind} order={activeOrder} onMove={move} />} /> : <JsonPanel key={`${kind}-${data.selected}-${config[kind]}`} id={kind} title={titles[kind]} source={pathLabel(config[kind])} value={values[kind]} globalQuery={globalQuery} request={requests[kind]} jump={jump} onLocalSearch={() => setGlobalInput('')} onClose={() => setVisible(old => ({ ...old, [kind]: false }))} summary={summaryMode} onSummary={setSummaryMode} move={<MoveButtons kind={kind} order={activeOrder} onMove={move} />} />)}
          {!activeOrder.length && <section className="render-empty"><div className="render-empty-icon"><FileJson size={38} strokeWidth={1.2} /></div><h2>原始数据已就绪</h2><p>在顶部选择字段，点击“渲染”打开轨迹或结果。<br />也可以将鼠标移到左侧字段旁，直接选择渲染方式。</p><div className="flex flex-wrap gap-3 justify-center">{(['trace', 'result1'] as const).filter(k => config[k] !== NONE).map(k => <button key={k} className="primary-button" onClick={() => setVisible(old => ({ ...old, [k]: true }))}>渲染{titles[k]} →</button>)}</div><span>先看原始结构，再决定如何呈现。</span></section>}
        </ResizablePanels>
      </div><footer className="workspace-foot"><span>文件内容不上传 · 关闭页面后需重新打开文件</span><span>整体搜索仅当前题 · M 蓝色 / C 紫色 · 面板可独立滚动</span></footer>
    </>}
    {dragging && <div className="drop-overlay"><FileJson size={48} /><h2>松开以打开 JSON / JSONL</h2><p>只在浏览器内解析 · 可替换或追加</p></div>}
    {pendingFile && <ImportChoice file={pendingFile} count={data.rows.length} onCancel={() => setPendingFile(undefined)} onChoose={mode => { data.load(pendingFile, mode); setPendingFile(undefined); }} />}
    {toast && <div className="toast" role="status">{toast}<button aria-label="关闭提示" onClick={() => setToast('')}><X size={16} /></button></div>}
    {indexDialog && <IndexSettingsDialog settings={indexSettings.settings} detected={detectedNames} onClose={() => setIndexDialog(false)} onApply={settings => { const saved = indexSettings.apply(settings); setIndexDialog(false); setToast(saved ? '轮次标识已应用并记住；原始 JSON、结果1、结果2同步生效。' : '轮次标识已应用；浏览器存储不可用，刷新后需重新配置。'); }} />}
    {paste && <PasteDialog count={data.rows.length} busy={!!data.progress} onClose={() => setPaste(false)} onImport={(file, mode) => { if (data.progress) return; setPaste(false); data.load(file, mode); }} />}
    {help && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setHelp(false); }}><section className="modal" role="dialog" aria-modal="true" aria-label="使用说明"><header><h2>使用 Trace Studio</h2><button className="icon-button" aria-label="关闭弹窗" onClick={() => setHelp(false)}><X size={18} /></button></header><div className="help-content"><p><b>1. 打开数据</b> · 选择或拖入 JSON / JSONL，也可以点右上角“粘贴”直接输入文本。JSON 整段一条，JSONL 每行一条；支持追加或替换当前列表，重复 ID 不合并。</p><p><b>2. 配置视图</b> · 轨迹支持 messages、常见 inputs、嵌套消息和 JSON 字符串。不识别的内容保留原文，不虚构角色。结果1 / 2可以选择任意字段，也可以不显示。</p><p><b>3. 复核与定位</b> · 每栏独立搜索；顶部整体搜索当前题所有已打开区域。Enter 下一个、Shift+Enter 上一个。M# 按原始数组从0开始；顶部“轮次标识”可配置 round_index 等别名及 [数字] 引用。C# 始终按 call_index 查找，建议将调用记录配置到结果2。</p><p><b>4. 阅读习惯</b> · USER 在右，ASSISTANT 在左。标题栏 ← → 调整预览顺序，原始 JSON 固定保留。右上角月亮／太阳按钮切换日间和夜间，浏览器记住主题和轮次标识。大数组分批加载，搜索会自动展开并定位目标。</p><p><b>数据与更新</b> · 文件和粘贴内容只在浏览器本地处理，不发送服务器；不执行轨迹中的代码，也不自动加载外部图片。网页更新后刷新即可，但需要重新导入数据。</p></div></section></div>}
  </div></MessageIndexContext.Provider>;
}
