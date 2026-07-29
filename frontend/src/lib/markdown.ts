/**
 * Lightweight Markdown → HTML converter (no external deps).
 * Supports: headings, bold/italic, code, fenced blocks,
 *           lists, blockquotes, links, and hr.
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Fenced code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_: string, lang: string, code: string) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`,
    )

    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')

    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Blockquotes (already escaped > to &gt;)
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

    // Horizontal rule
    .replace(/^---+$/gm, '<hr/>')

    // List items
    .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
    .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')

    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs — wrap non-tag lines
  html = html
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return '';
      const blockStart = ['<h', '<ul', '<li', '<pre', '<block', '<hr', '</'];
      if (blockStart.some((s) => t.startsWith(s))) return t;
      return `<p>${t}</p>`;
    })
    .join('\n');

  return html;
}
