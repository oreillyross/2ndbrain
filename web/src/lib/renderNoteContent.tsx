import type { ReactNode } from "react";

export function renderNoteContent(
  content: string,
  onLinkClick: (title: string) => void
): ReactNode[] {
  const regex = /\[\[(.*?)\]\]/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [fullMatch, title] = match;

    // text before link
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    // link itself
    parts.push(
      <span
        key={match.index}
        onClick={() => onLinkClick(title)}
        className="text-blue-500 cursor-pointer underline"
      >
        {title}
      </span>
    );

    lastIndex = match.index + fullMatch.length;
  }

  // remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}