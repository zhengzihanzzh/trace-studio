import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Highlight } from './ui';

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A' && node.getAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});

export function Content({ text, rendered, query = '', activeOffset = -1 }: { text: string; rendered: boolean; query?: string; activeOffset?: number }) {
  const html = useMemo(() => rendered && !query ? DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true, gfm: true }) as string, {
    FORBID_TAGS: ['img', 'svg', 'math', 'iframe', 'style', 'form', 'input', 'button', 'video', 'audio', 'object', 'embed'],
    FORBID_ATTR: ['style', 'src', 'srcset', 'id', 'name'],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|#)/i,
  }) : '', [text, rendered, query]);
  if (rendered && !query) return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className="plain-text"><Highlight text={text} query={query} activeOffset={activeOffset} /></div>;
}
