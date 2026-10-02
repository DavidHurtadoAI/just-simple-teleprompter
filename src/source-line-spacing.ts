const TEXT_BLOCKS = "p, li, h1, h2, h3, h4, h5, h6";
const BLOCK_CONTENT = "p, ul, ol, blockquote, pre, table, div, h1, h2, h3, h4, h5, h6";
const PRESERVE_CONTENT = "pre, code, svg, math, .math, .internal-embed, .external-embed, .jst-source-line";

/** Keep each Markdown line together so its wrapped rows share a fixed line height. */
export function applySourceLineSpacing(root: HTMLElement): void {
  for (const block of root.querySelectorAll<HTMLElement>(TEXT_BLOCKS)) {
    if (block.closest(PRESERVE_CONTENT)) {
      continue;
    }

    let inlineNodes: ChildNode[] = [];
    for (const node of Array.from(block.childNodes)) {
      if (node.instanceOf(Element) && node.matches(BLOCK_CONTENT)) {
        wrapInlineLines(inlineNodes);
        inlineNodes = [];
      } else {
        inlineNodes.push(node);
      }
    }
    wrapInlineLines(inlineNodes);
  }
}

function wrapInlineLines(nodes: ChildNode[]): void {
  const first = nodes[0];
  if (!first || !nodes.some((node) =>
    node.textContent?.trim() ||
    (node.instanceOf(Element) && (node.nodeName === "BR" || node.querySelector("br")))
  )) {
    return;
  }

  const document = first.ownerDocument;
  if (!document) {
    return;
  }
  const domWindow = document.win as typeof window;
  const content = domWindow.createSpan();
  first.before(content);
  content.append(...nodes);

  const walker = document.createTreeWalker(
    content,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.instanceOf(Element) && node.matches(PRESERVE_CONTENT)) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeType === Node.TEXT_NODE || node.nodeName === "BR"
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    }
  );
  const renderedNodes: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    renderedNodes.push(node);
  }

  const breaks: Element[] = [];
  for (const node of renderedNodes) {
    if (node.instanceOf(Element)) {
      breaks.push(node);
      continue;
    }

    // Renderers may emit either a soft newline or a <br> followed by a newline.
    const text = (node.textContent ?? "").replace(/\r\n?/g, "\n");
    let sourceText = node.previousSibling?.nodeName === "BR" && text.startsWith("\n")
      ? text.slice(1)
      : text;
    if (node === renderedNodes[renderedNodes.length - 1]) {
      sourceText = sourceText.replace(/\n$/, "");
    }
    if (!text.includes("\n")) {
      continue;
    }
    const parts = sourceText.split("\n");
    const replacement = domWindow.createFragment();
    for (const [index, part] of parts.entries()) {
      if (index > 0) {
        const br = domWindow.createEl("br");
        breaks.push(br);
        replacement.append(br);
      }
      replacement.append(document.createTextNode(part));
    }
    node.parentNode?.replaceChild(replacement, node);
  }

  if (breaks.length === 0) {
    content.replaceWith(...content.childNodes);
    return;
  }

  const lines = domWindow.createFragment();
  for (const br of breaks) {
    const range = document.createRange();
    range.setStart(content, 0);
    range.setEndBefore(br);
    appendLine(lines, range.extractContents());
    br.remove();
  }
  const range = document.createRange();
  range.selectNodeContents(content);
  appendLine(lines, range.extractContents());
  content.replaceWith(lines);
}

function appendLine(lines: DocumentFragment, contents: DocumentFragment): void {
  const domWindow = lines.ownerDocument.win as typeof window;
  const line = domWindow.createSpan();
  line.className = "jst-source-line";
  line.append(contents);
  if (!line.textContent && !line.querySelector("img, svg, math, br, .math, .internal-embed, .external-embed")) {
    line.append(domWindow.createEl("br"));
  }
  lines.append(line);
}
