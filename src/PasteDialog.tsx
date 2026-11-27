import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { preparePaste, type PasteFormat } from './pasteInput';
import type { ImportMode } from './useDataset';

export function PasteDialog({ count, busy, onImport, onClose }: { count: number; busy: boolean; onImport: (file: File, mode: ImportMode) => void; onClose: () => void }) {
  const [text, setText] = useState(''), [format, setFormat] = useState<PasteFormat>('auto'), [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null), dialog = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; input.current?.focus(); return () => previous?.focus(); }, []);
  function submit(mode: ImportMode) {
    if (busy) { setError('正在导入数据，请等待完成或取消后重试。'); return; }
    try {
      const prepared = preparePaste(text, format);
      onImport(new File([text.replace(/^\uFEFF/, '')], `粘贴内容.${prepared.format}`, { type: prepared.format === 'json' ? 'application/json' : 'application/x-ndjson' }), mode);
    } catch (e) { setError(e instanceof Error ? e.message : '内容无法解析，当前列表未更改。'); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal paste-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="paste-title" onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLElement>('button, textarea, select')].filter(el => !el.hasAttribute('disabled')); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}>
      <header><h2 id="paste-title">粘贴 JSON / JSONL 数据</h2><button className="icon-button" aria-label="关闭粘贴窗口" onClick={onClose}><X size={18} /></button></header>
      <div className="paste-format"><label htmlFor="paste-format">解析格式</label><select id="paste-format" value={format} onChange={e => { setFormat(e.target.value as PasteFormat); setError(''); }}><option value="auto">自动识别 JSON / JSONL</option><option value="json">JSON · 整段为一条记录</option><option value="jsonl">JSONL · 每行一条记录</option></select></div>
      <p>JSON 支持多行对象，整个数组也保留为一条记录；JSONL 每行一条。只在浏览器中处理，不上传内容。</p>
      <textarea ref={input} aria-label="JSON 或 JSONL 内容" value={text} onChange={e => { setText(e.target.value); setError(''); }} placeholder={'在此粘贴 JSON 或 JSONL 文本\n例如：{"id":"001","messages":[{"role":"user","content":"你好"}]}'} />
      {error && <p role="alert" className="paste-error">{error}</p>}
      <footer><span>{count ? `当前 ${count.toLocaleString()} 条 · 替换仅影响此页面` : '当前列表为空'}</span><button className="secondary-button" onClick={onClose}>取消</button>{count > 0 && <button className="secondary-button" disabled={!text.trim() || busy} onClick={() => submit('append')}>追加到当前列表</button>}<button className="primary-button" disabled={!text.trim() || busy} onClick={() => submit('replace')}>{count ? '替换当前列表' : '解析并打开'}</button></footer>
    </section>
  </div>;
}
