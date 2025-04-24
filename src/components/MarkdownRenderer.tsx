import { useState, useEffect } from 'react';
import MarkdownIt from 'markdown-it';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const md = new MarkdownIt({
      html: false,
      breaks: true,
      linkify: true
    });

    const renderedHtml = md.render(content);
    setHtml(renderedHtml);
  }, [content]);

  return (
    <div
      className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
