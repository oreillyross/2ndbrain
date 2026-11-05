import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteMarkdown } from "./NoteMarkdown";

const render = (content: string) => renderToStaticMarkup(<NoteMarkdown content={content} />);

describe("NoteMarkdown XSS regression", () => {
  it("does not render raw <script>", () => {
    const html = render("hi <script>alert(1)</script> there");
    expect(html).not.toMatch(/<script/i);
  });

  it("does not render raw HTML with event handlers", () => {
    const html = render(`<img src="x" onerror="alert(1)"> <div onclick="alert(1)">x</div>`);
    // Raw HTML must come out as escaped text, never as elements/attributes.
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<div/i);
    expect(html).not.toMatch(/\son\w+="/i);
    expect(html).toContain("&lt;img");
  });

  it("strips javascript: links", () => {
    const html = render("[click](javascript:alert(1)) and [b](JaVaScRiPt:alert(1))");
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("strips javascript: in images and autolinks", () => {
    const html = render("![x](javascript:alert(1)) <javascript:alert(1)>");
    expect(html).not.toMatch(/(src|href)="javascript:/i);
  });

  it("still renders normal markdown and safe links", () => {
    const html = render("# Title\n\n**bold** [site](https://example.com)");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
