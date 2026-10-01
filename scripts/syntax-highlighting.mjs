import hljs from 'highlight.js/lib/common';
import x86asm from 'highlight.js/lib/languages/x86asm';
import armasm from 'highlight.js/lib/languages/armasm';

hljs.registerLanguage('x86asm', x86asm);
hljs.registerLanguage('armasm', armasm);

const aliases = {
  'c++': 'cpp', js: 'javascript', ts: 'typescript', py: 'python',
  sh: 'bash', html: 'xml', yml: 'yaml', console: 'shell'
};
const plainLanguages = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'nohighlight']);

export function highlightMarkdownCode(code, info) {
  const label = String(info || '').trim().toLowerCase().split(/\s+/)[0];
  const language = aliases[label] || label;
  if (plainLanguages.has(language) || !/^[a-z0-9_+-]+$/.test(language) || !hljs.getLanguage(language)) return '';
  try {
    const html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    return `<pre><code class="hljs language-${language}">${html}</code></pre>`;
  } catch {
    return '';
  }
}
