import { X } from 'lucide-react';
import type { ImportMode } from './useDataset';
export function ImportChoice({ file, count, onChoose, onCancel }: { file: File; count: number; onChoose: (mode: ImportMode) => void; onCancel: () => void }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}><section className="modal import-modal" role="dialog" aria-modal="true" aria-label="选择导入方式">
    <header><h2>如何打开新文件？</h2><button className="icon-button" aria-label="取消导入" onClick={onCancel}><X size={18} /></button></header>
    <p className="import-file">{file.name}</p><p>当前已有 {count.toLocaleString()} 条记录。JSON 整个文件为一条记录；JSONL 每行一条。</p>
    <div className="import-options"><button autoFocus className="secondary-button" onClick={() => onChoose('append')}>追加到当前列表</button><button className="primary-button" onClick={() => onChoose('replace')}>替换当前列表</button><button className="secondary-button" onClick={onCancel}>取消</button></div>
    <small>追加保留原有记录、字段配置和当前选题；重复 ID 独立保留。替换只影响当前页面，不修改本地文件。</small>
  </section></div>;
}
