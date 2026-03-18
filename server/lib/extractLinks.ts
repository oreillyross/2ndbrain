export function extractLinks(content: string): string[] {
  const regex = /\[\[(.*?)\]\]/g;

  const matches = [...content.matchAll(regex)];

  return matches.map((m) => m[1].trim()).filter(Boolean);
}