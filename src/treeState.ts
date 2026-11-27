export type TreeState = { depth: number; overrides: Record<string, boolean>; forced: Set<string>; limits: Record<string, number>; branches?: Record<string, boolean> };
export const withinBranch = (path: string, root: string) => !root || path === root || path.startsWith(root + '/');
export function isNodeOpen(state: TreeState, path: string, level: number): boolean {
  if (state.forced.has(path)) return true;
  if (Object.hasOwn(state.overrides, path)) return state.overrides[path];
  let current = path;
  while (true) {
    if (state.branches && Object.hasOwn(state.branches, current)) return state.branches[current];
    if (!current) break;
    current = current.slice(0, current.lastIndexOf('/'));
  }
  return level < state.depth;
}
export function setBranch(state: TreeState, path: string, open: boolean): TreeState {
  return { ...state,
    overrides: Object.fromEntries(Object.entries(state.overrides).filter(([key]) => !withinBranch(key, path))),
    branches: { ...Object.fromEntries(Object.entries(state.branches || {}).filter(([key]) => !withinBranch(key, path))), [path]: open },
    forced: new Set([...state.forced].filter(key => !withinBranch(key, path))),
  };
}
