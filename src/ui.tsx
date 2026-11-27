import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { offsets } from './model';

export type FocusRequest = { token: number; path?: string; kind?: 'key' | 'value'; offset?: number; message?: number; index?: number };
export type Jump = (kind: 'message' | 'call', index: number) => void;
export function useDebounced<T>(value: T, delay = 180) {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return settled;
}
export function SearchBox({ value, onChange, count, current, onMove, label, pending = false }: {
  value: string; onChange: (value: string) => void; count: number; current: number; onMove: (delta: number) => void; label: string; pending?: boolean;
}) {
  return <div className="search-box">
    <Search size={14} className="shrink-0 text-slate-400" />
    <input aria-label={label} value={value} placeholder={label} onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onMove(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') onChange(''); }} />
    {value && <><span className="search-count" aria-live="polite">{pending ? '…' : count ? `${Math.max(0, current) + 1}/${count}` : '0 个'}</span>
      <button title="清除搜索" aria-label={`清除${label}`} onClick={() => onChange('')}><X size={13} /></button></>}
    <button disabled={!count} title="上一个 · Shift+Enter" aria-label={`${label}上一个结果`} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
    <button disabled={!count} title="下一个 · Enter" aria-label={`${label}下一个结果`} onClick={() => onMove(1)}><ArrowDown size={14} /></button>
  </div>;
}
export function Highlight({ text, query, activeOffset = -1, kind = 'value', start = 0, end = text.length }: { text: string; query: string; activeOffset?: number; kind?: string; start?: number; end?: number }) {
  if (!query) return <>{text.slice(start, end)}</>;
  let at = start; const nodes: ReactNode[] = [];
  const matches = offsets(text, query);
  for (const offset of matches) {
    if (offset + query.length <= start || offset >= end) continue;
    const from = Math.max(start, offset), to = Math.min(end, offset + query.length);
    nodes.push(text.slice(at, from));
    nodes.push(<mark key={offset} data-offset={offset} data-kind={kind} className={offset === activeOffset ? 'active-hit' : ''}>{text.slice(from, to)}</mark>);
    at = to;
  }
  nodes.push(text.slice(at, end)); return <>{nodes}</>;
}
export function scrollTarget(container: HTMLElement | null, target: HTMLElement | null) {
  if (!container || !target) return;
  const rect = target.getBoundingClientRect(), base = container.getBoundingClientRect();
  container.scrollTo({ top: Math.max(0, container.scrollTop + rect.top - base.top - 18), behavior: 'auto' });
  // Only move the horizontal workspace when a panel is out of view; don't scroll the page.
  const workspace = container.closest('.panels');
  if (workspace) {
    const a = workspace.getBoundingClientRect(), b = container.closest('.panel')!.getBoundingClientRect();
    if (b.left < a.left || b.right > a.right) workspace.scrollBy({ left: b.left - a.left, behavior: 'smooth' });
  }
}
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export function RoleBadge({ role }: { role: string }) {
  const recognized = ['user', 'assistant', 'tool', 'system'].includes(role);
  return <span className={`role-badge ${recognized ? role : 'unknown'}`}>{role.toUpperCase()}</span>;
}
