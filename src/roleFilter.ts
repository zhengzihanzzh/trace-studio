import type { ChatMessage } from './model';
export function roleOptions(messages: ChatMessage[]) {
  const counts = new Map<string, number>();
  for (const message of messages) counts.set(message.role, (counts.get(message.role) || 0) + 1);
  const preferred = ['system', 'user', 'assistant', 'tool'];
  return [...counts].map(([role, count]) => ({ role, count })).sort((a, b) => {
    const rank = (role: string) => preferred.includes(role) ? preferred.indexOf(role) : preferred.length;
    return rank(a.role) - rank(b.role);
  });
}
export function visibleMessages(messages: ChatMessage[], excluded: string[]) {
  const hidden = new Set(excluded);
  return messages.map((message, position) => ({ message, position })).filter(item => !hidden.has(item.message.role));
}
