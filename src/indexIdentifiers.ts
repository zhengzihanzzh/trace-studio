import { indexKind, indexReferences, normalizeAliases, type IndexConfig } from './indexReferences';

export function normalizeDisabled(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string').map(v => v.trim().toLowerCase()).filter(Boolean))].slice(0, 128);
}
export function identifierNames(config: IndexConfig, detected: string[] = []): string[] {
  return [...new Set(['message_index', ...config.aliases, ...detected])].filter(name => !config.disabled?.includes(name));
}
export function removeIdentifier(config: IndexConfig, name: string): IndexConfig {
  const normalized = name.trim().toLowerCase();
  return { ...config, aliases: config.aliases.filter(v => v !== normalized), disabled: normalizeDisabled([...(config.disabled || []), normalized]) };
}
export function addIdentifiers(config: IndexConfig, text: string): IndexConfig {
  const names = [...new Set(text.split(/[,，;；\n]+/).map(v => v.trim().toLowerCase()).filter(Boolean))];
  if (!names.length) throw new Error('请输入要添加的标识名。');
  const aliases = normalizeAliases([...config.aliases, ...names].join(','));
  return { ...config, aliases, disabled: (config.disabled || []).filter(v => !names.includes(v)) };
}
// 只检测当前记录，有界遍历；不扫描整个文件，也不擅自启用round/index等歧义名称。
export function detectedIdentifiers(value: unknown, config: IndexConfig): string[] {
  const names = new Set<string>(), pending: unknown[] = [value];
  const enabled = { ...config, disabled: [] };
  let visited = 0;
  while (pending.length && visited++ < 30000 && names.size < 64) {
    const current = pending.pop();
    if (typeof current === 'string') {
      for (const ref of indexReferences(current.slice(0, 100000), enabled)) if (ref.kind === 'message' && ref.label !== '[数字]') names.add(ref.label.toLowerCase());
    } else if (current && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (indexKind(key, enabled) === 'message') names.add(key.toLowerCase());
        if (pending.length < 30000) pending.push(child);
        if (names.size >= 64) break;
      }
    }
  }
  return [...names];
}
