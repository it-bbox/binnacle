import { Marked } from 'marked';

/**
 * A ticket's body and Review as HTML (`docs/specs/dashboard-redesign/spec.md`, *Markdown on the
 * Task page*). Raw HTML is shown as text, a link goes only to the web or to mail, and an image
 * is its text, so that a ticket injects nothing and the page loads nothing but the daemon.
 * Free of Nuxt, for the tests.
 */

const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SAFE_LINK = /^(https?:|mailto:)/i;

const renderer = new Marked({
  renderer: {
    html: ({ text }) => escape(text),
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return SAFE_LINK.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
    },
    image: ({ text }) => escape(text),
  },
});

export const markdown = (text: string): string => renderer.parse(text, { async: false });
