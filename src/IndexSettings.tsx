import { createContext, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_INDEX_CONFIG, normalizeAliases, type IndexConfig } from './indexReferences';
import { addIdentifiers, identifierNames, normalizeDisabled, removeIdentifier } from './indexIdentifiers';

const STORAGE_KEY = 'trace-studio.message-index.v1';
export const MessageIndexContext = createContext<IndexConfig>(DEFAULT_INDEX_CONFIG);
export function useIndexSettings() {
  const [settings, setSettings] = useState<IndexConfig>(() => {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (v && Array.isArray(v.aliases) && v.aliases.every((s: unknown) => typeof s === 'string')) return { aliases: normalizeAliases(v.aliases.join(',')), bracketed: v.bracketed === true, disabled: normalizeDisabled(v.disabled) };
    } catch { /* 存储不可用时使用安全默认值。 */ }
    return DEFAULT_INDEX_CONFIG;
  });
  function apply(config: IndexConfig) {
    setSettings(config);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return true; } catch { return false; }
  }
  return { settings, apply };
}
export function IndexSettingsDialog({ settings, detected = [], onApply, onClose }: { settings: IndexConfig; detected?: string[]; onApply: (config: IndexConfig) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings), [text, setText] = useState(''), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLElement>(null);
  const names = identifierNames(draft, detected);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; input.current?.focus(); return () => previous?.focus(); }, []);
  function add(value = text) {
    try { setDraft(addIdentifiers(draft, value)); setText(''); setError(''); input.current?.focus(); } catch (e) { setError(String((e as Error).message)); }
  }
  function remove(name: string) { setDraft(removeIdentifier(draft, name)); setError(''); }
  function save() { try { onApply(text.trim() ? addIdentifiers(draft, text) : draft); } catch (e) { setError(String((e as Error).message)); } }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal index-settings-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="index-settings-title" onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLElement>('button, textarea, input')].filter(el => !el.hasAttribute('disabled')); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}>
      <header><h2 id="index-settings-title">轮次标识 · message_index 别名</h2><button className="icon-button" aria-label="关闭轮次标识设置" onClick={onClose}><X size={18} /></button></header>
      <p>以下为当前生效的标识，与顶部摘要一致，映射到执行轨迹的 <b>蓝色 M#</b> 跳转。点击 × 可停用该名称，不会删除原始数据。</p>
      <div className="identifier-list" role="group" aria-label="当前生效的轮次标识"><div className="identifier-heading"><b>当前生效的标识</b><span>{names.length + Number(draft.bracketed)} 个</span></div><div className="identifier-tags">{names.map(name => <span className="identifier-tag" key={name}><code>{name}</code><small>{draft.aliases.includes(name) ? '自定义' : detected.includes(name) ? '当前记录已识别' : '默认'}</small><button aria-label={`删除轮次标识 ${name}`} title={`停用 ${name}`} onClick={() => remove(name)}><X size={13} /></button></span>)}{draft.bracketed && <span className="identifier-tag"><code>[数字]</code><small>无字段名引用</small><button aria-label="删除轮次标识 [数字]" title="停用无字段名的方括号引用" onClick={() => setDraft({ ...draft, bracketed: false })}><X size={13} /></button></span>}{!names.length && !draft.bracketed && <span className="identifier-empty">暂无生效标识，可以在下方添加。</span>}</div></div>
      {!!draft.disabled?.length && <div className="identifier-removed"><span>已停用：</span>{draft.disabled.map(name => <button key={name} title={`重新启用 ${name}`} aria-label={`恢复轮次标识 ${name}`} onClick={() => add(name)}>{name}<Plus size={12} /></button>)}</div>}
      <label htmlFor="message-index-aliases">补充其他标识名（可用逗号分隔多个）</label>
      <div className="identifier-add"><input id="message-index-aliases" ref={input} value={text} onChange={e => { setText(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="例如：round_index, round, index, 轮次, [xxx]" /><button className="secondary-button" onClick={() => add()}><Plus size={14} />添加</button></div>
      <div className="index-presets"><span>快捷添加：</span>{['round_index', 'round', 'index'].map(alias => <button key={alias} disabled={names.includes(alias)} className={names.includes(alias) ? 'selected' : ''} onClick={() => add(alias)}>{alias}</button>)}</div>
      <label className="bracket-option"><input type="checkbox" checked={draft.bracketed} onChange={e => setDraft({ ...draft, bracketed: e.target.checked })} />同时识别无字段名的 [12]、[1, 2] 形式</label>
      <p className="index-warning">通用的 index 或 [数字] 可能是普通序号，请仅在数据确实用它表示消息轮次时启用。call_index 始终定位调用记录，不会变成消息索引。</p>
      <div className="index-examples"><b>支持的结果形式</b><code>{'{"round_index": 4} · {"round_index": [4, 5]}\n文本：round_index=4 / round_index: 4 / [xxx]=4'}</code><span>应用后原始 JSON、结果1和结果2同时生效。按原始消息数组从0开始，不自动加减1；目标不存在会提示。</span></div>
      {error && <p role="alert" className="index-error">{error}</p>}
      <footer><button className="secondary-button" onClick={() => { setDraft(DEFAULT_INDEX_CONFIG); setText(''); setError(''); }}>恢复默认</button><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={save}>应用并记住</button></footer>
    </section>
  </div>;
}
