import { Content } from './Content';
import { toolBlocks, toolJson } from './toolBlocks';
import { contentText } from './model';
import { isImage, mediaParts } from './media';
import { MediaContent } from './MediaContent';
export function ToolContent({ text, role, raw }: { text: string; role: string; raw?: any }) {
  const message = raw?.message ?? raw, content = message?.content;
  if (isImage(content)) return role === 'tool' ? <ResultCard name={message?.tool_call_id || '工具返回'} content={content} /> : <MediaContent content={content} />;
  if (typeof content === 'string') {
    const body = content.replace(/^\s*\[tool_result(?::[^\]]*)?\]\s*/, '');
    if (mediaParts(body).some(p => p.kind === 'image')) return role === 'tool' || body !== content ? <ResultCard name={message?.tool_call_id || '工具返回'} content={body} /> : <MediaContent content={content} />;
  }
  if (Array.isArray(content) && mediaParts(content).some(p => p.kind === 'image')) return <>
    {message.reasoning_content && <Content text={'[thinking]\n' + contentText(message.reasoning_content)} rendered query="" />}
    {content.map((block: any, i: number) => block?.type === 'tool_result' ? <ResultCard key={i} name={block.tool_use_id || '工具返回'} content={block.content} /> : block?.type === 'tool_use' || block?.type === 'function_call' ? <ToolContent key={i} role="assistant" text={contentText([block])} /> : ['image', 'image_url', 'input_image'].includes(block?.type) ? <MediaContent key={i} content={block} /> : <ToolContent key={i} text={contentText([block])} role={role} />)}
    {message.tool_calls?.map((call: any, i: number) => <ToolContent key={'call-' + i} role="assistant" text={'[tool_use:' + (call.function?.name || call.name || 'unknown') + ']\n' + contentText(call.function?.arguments ?? call.arguments ?? call.input)} />)}
  </>;
  return <>{toolBlocks(text, role).map((block, i) => {
    if (block.kind === 'text') return mediaParts(block.text).some(p => p.kind === 'image') ? <MediaContent key={i} content={block.text} /> : <Content key={i} text={block.text} rendered={role !== 'system'} query="" />;
    if (block.kind === 'result') return <ResultCard key={i} name={block.name || message?.tool_call_id || '工具返回'} content={block.text} />;
    const value = toolJson(block.text), object = value !== null && typeof value === 'object' && !Array.isArray(value);
    return <section key={i} className="tool-card"><header><b>TOOL CALL</b><strong>{block.name || '工具调用'}</strong></header>
      {object ? <dl className="tool-fields">{Object.entries(value as Record<string, unknown>).map(([key, v]) => <div key={key}><dt>{key}</dt><dd><pre>{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre></dd></div>)}</dl>
        : value !== undefined ? <pre className="tool-json">{JSON.stringify(value, null, 2)}</pre>
        : <pre className="tool-json">{block.text || '（无参数）'}</pre>}
    </section>;
  })}</>;
}
function ResultCard({ name, content }: { name: string; content: unknown }) {
  const hasMedia = mediaParts(content).some(p => p.kind === 'image'), text = typeof content === 'string' ? content : contentText(content), value = toolJson(text);
  return <section className="tool-card tool-result-card"><header><b>TOOL RESULT</b><strong>{name}</strong></header>
    {hasMedia ? <div className="tool-output"><MediaContent content={content} /></div> : value !== null && typeof value === 'object' && !Array.isArray(value) ? <dl className="tool-fields">{Object.entries(value as Record<string, unknown>).map(([key, v]) => <div key={key}><dt>{key}</dt><dd><pre>{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre></dd></div>)}</dl>
      : value !== undefined ? <pre className="tool-json">{JSON.stringify(value, null, 2)}</pre> : <div className="tool-output"><Content text={text || '（空返回）'} rendered query="" /></div>}
  </section>;
}
