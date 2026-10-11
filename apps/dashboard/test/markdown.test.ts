import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markdown } from '../app/markdown.ts';

/**
 * A ticket's body and Review as the Task page renders them (`docs/specs/dashboard-redesign/spec.md`,
 * *Markdown on the Task page*): headings, paragraphs, lists, emphasis, inline code, code blocks
 * and links, with raw HTML shown as text, so that a ticket injects nothing into the page.
 */
describe('Markdown on the Task page', () => {
  it('renders a Review as a document', () => {
    const html = markdown('### Review\n\nThe **standards** hold, *mostly*.\n\n1. `Widget.vue` keys rows\n2. Kept\n\n- a\n- b\n\n```ts\nconst a = 1;\n```\n\nSee [the spec](https://example.com/spec).');
    assert.match(html, /<h3>Review<\/h3>/);
    assert.match(html, /<p>The <strong>standards<\/strong> hold, <em>mostly<\/em>\.<\/p>/);
    assert.match(html, /<ol>\s*<li><code>Widget\.vue<\/code> keys rows<\/li>/);
    assert.match(html, /<ul>\s*<li>a<\/li>/);
    assert.match(html, /<pre><code class="language-ts">const a = 1;\n<\/code><\/pre>/);
    assert.match(html, /<a href="https:\/\/example\.com\/spec" target="_blank" rel="noopener noreferrer">the spec<\/a>/);
  });

  it('shows raw HTML as text, block and inline', () => {
    const html = markdown('<script>alert(1)</script>\n\nA <img src=x onerror=alert(1)> b <b>bold</b>.\n\n<div onclick="x()">\n\nblock\n\n</div>');
    assert.doesNotMatch(html, /<script|<img|<b>|<div/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  });

  it('links only to the web and mail; any other link is its text', () => {
    const html = markdown('[run](javascript:alert(1)) [data](data:text/html,x) [doc](docs/a.md) [mail](mailto:a@b.c)');
    assert.doesNotMatch(html, /javascript:|data:|href="docs/);
    assert.match(html, /run data doc <a href="mailto:a@b\.c"/);
  });

  it('loads no image: an image is its text', () => {
    const html = markdown('![a chart](https://example.com/x.png)');
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<p>a chart<\/p>/);
  });
});
