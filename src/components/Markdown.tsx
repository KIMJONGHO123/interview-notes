import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** react-markdown 은 기본적으로 raw HTML 을 렌더링하지 않아 XSS 에 안전 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
