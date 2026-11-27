import { useEffect, useRef, useState } from 'react';
import { Check, Copy, AlertCircle } from 'lucide-react';
import { copyText } from './ui';
export function fieldCopyText(value: unknown): string { return typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? 'undefined'; }
export function FieldCopy({ value, label }: { value: unknown; label: string }) {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle'), timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    const ok = await copyText(fieldCopyText(value)); setStatus(ok ? 'ok' : 'error');
    clearTimeout(timer.current); timer.current = setTimeout(() => setStatus('idle'), 2200);
  }
  return <><button className={`field-copy ${status}`} title={status === 'ok' ? '已复制完整字段值' : status === 'error' ? '复制失败，请手动选中文本' : '复制完整字段值（不受折叠或截断影响）'} aria-label={`复制字段 ${label} 的值`} onClick={e => { e.stopPropagation(); void copy(); }}>{status === 'ok' ? <Check size={13} /> : status === 'error' ? <AlertCircle size={13} /> : <Copy size={13} />}{status === 'ok' && <span>已复制</span>}</button>{status === 'error' && <span role="status" className="copy-inline-error">复制失败，请手动复制</span>}</>;
}
