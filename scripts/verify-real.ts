import { openAsBlob } from 'node:fs';
import { indexFile } from '../src/parser.worker';
import { inferFields, normalizeTrace, parseLine, valueAt } from '../src/model';

for (const path of process.argv.slice(2)) {
  const file = await openAsBlob(path);
  const start = performance.now();
  const indexed = await indexFile(file);
  let messages = 0;
  for (const row of indexed.rows) {
    if (row.error) continue;
    const value = parseLine(await file.slice(row.start, row.end).text());
    const fields = inferFields(value);
    const trace = normalizeTrace(valueAt(value, fields.trace), fields.trace);
    messages += trace.messages.length;
    if (trace.messages.length && !trace.messages.every(m => m.index === null || Number.isInteger(m.index))) throw new Error('invalid index');
  }
  console.log(JSON.stringify({ file: path.split('/').pop(), megabytes: (file.size / 1024 / 1024).toFixed(1), records: indexed.rows.length, errors: indexed.rows.filter(r => r.error).length, fields: indexed.fields.length, messages, seconds: ((performance.now() - start) / 1000).toFixed(2) }));
}
