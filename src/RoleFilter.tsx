import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Users } from 'lucide-react';
import { RoleBadge } from './ui';

type RoleOption = { role: string; count: number };
export function RoleFilter({ roles, excluded, onChange }: { roles: RoleOption[]; excluded: string[]; onChange: (excluded: string[]) => void }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ left: 0, top: 0 });
  const anchor = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const selected = roles.filter(r => !excluded.includes(r.role)).length;
  function toggle() {
    if (!open) { const rect = anchor.current!.getBoundingClientRect(); setPosition({ left: Math.max(8, Math.min(rect.left, innerWidth - 240)), top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 320)) }); }
    setOpen(!open);
  }
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); anchor.current?.focus(); } };
    const close = () => setOpen(false);
    const scroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); window.addEventListener('resize', close); window.addEventListener('scroll', scroll, true);
    menu.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', close); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  return <><button className={`role-filter-button ${selected < roles.length ? 'filtered' : ''}`} ref={anchor} onClick={toggle} aria-label="筛选轨迹角色" aria-haspopup="dialog" aria-expanded={open} title="多选显示角色，隐藏不会改变message_index"><Users size={12} />角色 <span>{selected === roles.length ? '全部' : `${selected}/${roles.length}`}</span><ChevronDown size={11} /></button>
    {open && createPortal(<div ref={menu} className="role-filter-menu" role="dialog" aria-label="轨迹角色多选" style={position}>
      <header><b>显示的角色</b><span>{selected}/{roles.length}</span></header>
      <div className="role-filter-options">{roles.map(({ role, count }) => <label key={role}><input type="checkbox" aria-label={`显示 ${role.toUpperCase()} 角色`} checked={!excluded.includes(role)} onChange={e => onChange(e.target.checked ? excluded.filter(r => r !== role) : [...excluded, role])} /><RoleBadge role={role} /><span>{count} 条</span></label>)}</div>
      <footer><button onClick={() => onChange([])}>全选</button><button onClick={() => onChange(roles.map(r => r.role))}>全部取消</button></footer><p>只筛选轨迹显示，不改原始编号</p>
    </div>, document.body)}
  </>;
}
