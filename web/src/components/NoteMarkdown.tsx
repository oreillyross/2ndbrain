import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders note markdown. Raw HTML is NOT rendered (no rehype-raw) and
 * react-markdown's default URL sanitiser strips javascript:/data: links.
 * Never add rehype-raw without rehype-sanitize. See NoteMarkdown.test.tsx.
 */
export function NoteMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
        code: ({ children }) => <code className="bg-gray-100 rounded px-1 text-xs font-mono">{children}</code>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600">{children}</blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
