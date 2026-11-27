import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Content } from './Content';
import { mediaParts, type MediaInfo } from './media';
export function MediaContent({ content }: { content: unknown }) {
  return <>{mediaParts(content).map((part, i) => part.kind === 'text' ? part.text.trim() ? <Content key={i} text={part.text} rendered query="" /> : null : <MediaCard key={i} info={part.image} />)}</>;
}
function MediaCard({ info }: { info: MediaInfo }) {
  const [error, setError] = useState(false), [expanded, setExpanded] = useState(false);
  return <section className={`media-card ${info.status !== 'preview' || error ? 'media-unavailable' : ''}`}>
    <header><ImageIcon size={15} /><b>图片返回</b><span>{info.mime || '未知图片类型'} · {info.sourceType}</span></header>
    {info.src && !error ? <button className={`media-image-toggle ${expanded ? 'expanded' : ''}`} title="点击放大 / 缩小图片" aria-label="放大或缩小图片预览" onClick={() => setExpanded(!expanded)}><img src={info.src} alt="轨迹中的内嵌图片" loading="lazy" onError={() => setError(true)} /></button>
      : <p role="status">{error ? '图片数据损坏或不完整，无法显示。可查看消息原文。' : info.reason}</p>}
    <footer>{info.characters.toLocaleString()} 个编码字符 · {info.src && !error ? '本地解码，不联网 · 点击图片放大' : '未加载图片 · 原始数据保持不变'}</footer>
  </section>;
}
