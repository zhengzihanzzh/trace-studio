import { useEffect, useRef, useState } from 'react';
import { parseLine, type Json, type Row } from './model';
export type ImportMode = 'replace' | 'append';

export function useDataset() {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]), [parsingFile, setParsingFile] = useState<File | null>(null);
  const registry = useRef<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ loaded: number; count: number } | null>(null);
  const [blanks, setBlanks] = useState(0);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const [record, setRecord] = useState<Json>(undefined);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const worker = useRef<Worker>();
  const generation = useRef(0);

  function load(next: File, mode: ImportMode = 'replace') {
    worker.current?.terminate();
    setParsingFile(next); setError(''); setProgress({ loaded: 0, count: 0 });
    const w = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = event => {
      if (worker.current !== w) return;
      const data = event.data;
      if (data.type === 'progress') setProgress({ loaded: data.loaded, count: data.count });
      if (data.type === 'done') {
        if (data.rows.length) {
          const fileKey = mode === 'append' ? registry.current.length : 0;
          const additions: Row[] = data.rows.map((r: Row) => ({ ...r, fileKey, fileName: next.name }));
          registry.current = mode === 'append' ? [...registry.current, next] : [next];
          setFiles(registry.current);
          if (mode === 'replace') { setFile(next); setSelected(0); }
          setRows(old => mode === 'append' ? [...old, ...additions] : additions);
          setFields(old => mode === 'append' ? [...new Set([...old, ...data.fields])] : data.fields);
          setBlanks(old => mode === 'append' ? old + data.blanks : data.blanks);
        } else setError('文件为空，未更改当前列表。');
        setProgress(null); setParsingFile(null);
        w.terminate(); worker.current = undefined;
      }
      if (data.type === 'error') { setError('解析失败，当前列表未更改：' + data.error); setProgress(null); setParsingFile(null); w.terminate(); worker.current = undefined; }
    };
    w.onerror = event => { if (worker.current === w) { setError('解析失败，当前列表未更改：' + event.message); setProgress(null); setParsingFile(null); w.terminate(); worker.current = undefined; } };
    w.postMessage({ file: next });
  }
  function cancel() { worker.current?.terminate(); worker.current = undefined; setProgress(null); setParsingFile(null); setError('已取消导入，当前列表未更改。'); }
  function clear() { cancel(); generation.current++; registry.current = []; setFile(null); setFiles([]); setRows([]); setFields([]); setRecord(undefined); setRaw(''); setError(''); }
  const selectedRow = rows[selected];
  useEffect(() => {
    const row = selectedRow, source = row && registry.current[row.fileKey ?? 0];
    if (!row || !source) return;
    const token = ++generation.current;
    setLoading(true); setRecord(undefined); setRaw('');
    source.slice(row.start, row.end).text().then(text => {
      if (token !== generation.current) return;
      setRaw(text);
      try { setRecord(parseLine(text)); } catch { setRecord(undefined); }
      setLoading(false);
    }).catch(e => { if (token === generation.current) { setError(String(e)); setLoading(false); } });
    return () => { generation.current++; };
  }, [selectedRow]);
  useEffect(() => () => worker.current?.terminate(), []);
  return { file, files, parsingFile, rows, fields, progress, blanks, error, selected, record, raw, loading, load, cancel, clear, select: setSelected };
}
