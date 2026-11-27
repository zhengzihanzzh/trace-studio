import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, PanelLeftClose, Search } from 'lucide-react';
import { useDebounced } from './ui';
import type { Row } from './model';

export function Sidebar({ rows, selected, onSelect, onCollapse }: { rows: Row[]; selected: number; onSelect: (index: number) => void; onCollapse: () => void }) {
  const [query, setQuery] = useState(''), [top, setTop] = useState(0), [height, setHeight] = useState(600);
  const settled = useDebounced(query), scroll = useRef<HTMLDivElement>(null);
  const indices = useMemo(() => rows.map((_, i) => i).filter(i => !settled || [rows[i].id, rows[i].source, rows[i].fileName, rows[i].preview, String(rows[i].line)].join(' ').toLowerCase().includes(settled.toLowerCase())), [rows, settled]);
  useEffect(() => { if (!scroll.current) return; const r = new ResizeObserver(entries => setHeight(entries[0].contentRect.height)); r.observe(scroll.current); return () => r.disconnect(); }, []);
  useEffect(() => { const p = indices.indexOf(selected), el = scroll.current; if (p < 0 || !el) return; const y = p * 90; if (y < el.scrollTop || y + 90 > el.scrollTop + el.clientHeight) el.scrollTop = y; }, [selected, indices]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [settled]);
  const first = Math.max(0, Math.floor(top / 90) - 4), last = Math.min(indices.length, first + Math.ceil(height / 90) + 8);
  return <aside className="sidebar"><header><span className="font-semibold">选题导航</span><span className="pill">{rows.length.toLocaleString()}</span><span className="flex-1" /><button className="icon-button" title="收起选题导航" aria-label="收起选题导航" onClick={onCollapse}><PanelLeftClose size={17} /></button></header>
    <div className="sidebar-search"><Search size={14} /><input aria-label="搜索 ID、来源或题目" placeholder="搜索 ID、来源或题目" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className="sidebar-count">{settled ? `匹配 ${indices.length} 条` : '按文件行序 · 重复 ID 独立保留'}<span>{selected + 1}/{rows.length}</span></div>
    <div className="nav-scroll" ref={scroll} onScroll={e => setTop(e.currentTarget.scrollTop)}>
      {!indices.length && <div className="empty-panel"><p>没有匹配的记录</p></div>}
      <div style={{ height: indices.length * 90, position: 'relative' }}>{indices.slice(first, last).map((index, at) => <button key={index} className={`nav-item ${index === selected ? 'active' : ''} ${rows[index].error ? 'invalid' : ''}`} style={{ top: (first + at) * 90 }} onClick={() => onSelect(index)}>
        <div className="flex items-center gap-2"><span className="nav-number">{index + 1}</span><span className="nav-id" title={rows[index].id}>{rows[index].id}</span></div><p>{rows[index].error || rows[index].preview || '无可识别的用户消息，查看原始字段'}</p><span className="nav-source" title={rows[index].fileName}>{rows[index].fileName} · 第 {rows[index].line} 行{rows[index].source && ' · ' + rows[index].source}</span>
      </button>)}</div>
    </div>
    <footer><button disabled={!selected} onClick={() => onSelect(selected - 1)}><ArrowLeft size={14} />上一条</button><button disabled={selected >= rows.length - 1} onClick={() => onSelect(selected + 1)}>下一条<ArrowRight size={14} /></button></footer>
  </aside>;
}
