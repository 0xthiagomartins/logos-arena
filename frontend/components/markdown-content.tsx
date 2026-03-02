import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export default function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  return (
    <div className={`markdown-content text-sm leading-relaxed text-matrix-green ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

