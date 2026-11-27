import { Children, Fragment, useRef, useState, type ReactNode } from 'react';
export function ResizablePanels({ children, reset, signature }: { children: ReactNode; reset: number; signature: string }) {
  return <PanelGroup key={signature + ':' + reset}>{children}</PanelGroup>;
}
function PanelGroup({ children }: { children: ReactNode }) {
  const panels = Children.toArray(children), root = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>();
  const drag = useRef<{ index: number; x: number; widths: number[]; minLeft: number; minRight: number }>();
  function snapshot() { return [...(root.current?.querySelectorAll<HTMLElement>(':scope > .panel-slot') || [])].map(el => el.getBoundingClientRect().width); }
  function min(index: number) { return root.current?.querySelectorAll('.panel-slot')[index]?.querySelector('.chat-panel') ? 340 : 270; }
  function adjust(index: number, delta: number, initial = snapshot()) {
    const change = Math.max(min(index) - initial[index], Math.min(delta, initial[index + 1] - min(index + 1)));
    const next = [...initial]; next[index] += change; next[index + 1] -= change; setWidths(next);
  }
  return <div className="panels resizable-panels" ref={root}>{panels.map((panel, i) => <Fragment key={i}><div className="panel-slot" style={widths ? { flex: `1 1 ${widths[i]}px`, minWidth: min(i) } : undefined}>{panel}</div>
    {i < panels.length - 1 && <div className="panel-resizer" role="separator" aria-label={`调整第 ${i + 1} 和第 ${i + 2} 栏宽度`} aria-orientation="vertical" tabIndex={0} title="拖拽调整列宽 · 双击重置 · 方向键微调"
      onDoubleClick={() => setWidths(undefined)} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); adjust(i, e.key === 'ArrowLeft' ? -24 : 24); } if (e.key === 'Home') setWidths(undefined); }}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { index: i, x: e.clientX, widths: snapshot(), minLeft: min(i), minRight: min(i + 1) }; }}
      onPointerMove={e => { if (drag.current) adjust(drag.current.index, e.clientX - drag.current.x, drag.current.widths); }}
      onPointerUp={e => { drag.current = undefined; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = undefined; }}><span /></div>}
  </Fragment>)}</div>;
}
