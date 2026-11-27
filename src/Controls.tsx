import { ArrowLeft, ArrowRight, Eye, EyeOff, SlidersHorizontal, Hash, ChevronDown } from 'lucide-react';
import { NONE, pathLabel } from './model';
import type { RenderKind } from './JsonTree';

export type Config = Record<RenderKind, string>;
export type Visible = Record<RenderKind, boolean>;
export const titles: Record<RenderKind, string> = { trace: '执行轨迹', result1: '结果 1', result2: '结果 2' };
export function Controls({ fields, config, visible, onField, onVisible, onIndexSettings, indexAliasCount, indexAliasSummary }: { fields: string[]; config: Config; visible: Visible; onField: (kind: RenderKind, path: string) => void; onVisible: (kind: RenderKind) => void; onIndexSettings: () => void; indexAliasCount: number; indexAliasSummary: string }) {
  return <div className="preview-controls"><div className="config-bar" aria-label="预览配置">
    <span className="config-title" title="配置轨迹、结果1、结果2字段，再点击眼睛按钮渲染或隐藏"><SlidersHorizontal size={14} /><span>预览配置</span></span>
    {(['trace', 'result1', 'result2'] as RenderKind[]).map(kind => <div className={`field-control ${visible[kind] ? 'is-visible' : ''}`} key={kind}>
      <label htmlFor={`field-${kind}`} title={titles[kind] + '字段'}>{kind === 'trace' ? '轨迹' : kind === 'result1' ? '结果1' : '结果2'}</label>
      <select id={`field-${kind}`} aria-label={`${titles[kind]}字段`} title={pathLabel(config[kind])} value={config[kind]} onChange={e => onField(kind, e.target.value)}>
        <option value={NONE}>不选择</option><option value="">$（整条记录）</option>
        {[...new Set([...fields, ...(config[kind] !== NONE && config[kind] ? [config[kind]] : [])])].map(path => <option value={path} key={path}>{pathLabel(path)}</option>)}
      </select>
      <button className={`render-button ${visible[kind] ? 'is-on' : ''}`} onClick={() => onVisible(kind)} disabled={config[kind] === NONE} title={`${visible[kind] ? '隐藏' : '渲染'}${titles[kind]}`} aria-label={`${visible[kind] ? '隐藏' : '渲染'}${titles[kind]}`}>
        {visible[kind] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
    </div>)}
  </div><div className="index-settings-control" role="group" aria-label="轮次标识配置"><span className="index-settings-label"><Hash size={13} />轮次标识</span><button className={`index-settings-button ${indexAliasCount ? 'configured' : ''}`} title={`${indexAliasSummary} · 点击配置别名或 [数字] 引用`} aria-label="配置轮次标识" onClick={onIndexSettings}><span>{indexAliasSummary}</span>{indexAliasCount > 0 && <b>+{indexAliasCount}</b>}<ChevronDown size={12} /></button></div></div>;
}
export function MoveButtons({ kind, order, onMove }: { kind: RenderKind; order: RenderKind[]; onMove: (kind: RenderKind, delta: number) => void }) {
  const index = order.indexOf(kind);
  return <><button className="icon-button" title="此栏左移" aria-label={`${titles[kind]}左移`} disabled={index === 0} onClick={() => onMove(kind, -1)}><ArrowLeft size={13} /></button><button className="icon-button" title="此栏右移" aria-label={`${titles[kind]}右移`} disabled={index === order.length - 1} onClick={() => onMove(kind, 1)}><ArrowRight size={13} /></button></>;
}
