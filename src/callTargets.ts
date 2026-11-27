import { findCall, NONE, type Json } from './model';
export function callTargets(config: { result1: string; result2: string }, values: { result1: Json; result2: Json }, index: number) {
  const candidates: { panel: 'result1' | 'result2'; path: string; absolute: string }[] = [];
  // 同一调用既在父结果中也在独立结果 2 中时，优先定位独立结果 2。
  for (const panel of ['result2', 'result1'] as const) {
    if (config[panel] === NONE) continue;
    for (const path of findCall(values[panel], index, true)) candidates.push({ panel, path, absolute: config[panel] + path });
  }
  return candidates.filter((candidate, i) => candidates.findIndex(other => other.absolute === candidate.absolute) === i);
}
