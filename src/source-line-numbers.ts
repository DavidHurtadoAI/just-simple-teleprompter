import type { CachedMetadata } from "obsidian";

const SECTION_SELECTORS: Record<string, string> = {
  heading: "h1, h2, h3, h4, h5, h6", paragraph: "p", list: "ul, ol",
  blockquote: "blockquote", callout: ".callout", code: "pre", table: "table, .table-wrapper",
  thematicBreak: "hr", math: ".math"
};

/** Use Obsidian's source positions, including hidden frontmatter and blank lines. */
export function applySourceLineNumbers(root: HTMLElement, source: string, cache: CachedMetadata | null): void {
  const sourceLines = source.split(/\r\n?|\n/);
  const blocks = Array.from(root.children);
  let blockIndex = 0;
  for (const section of cache?.sections ?? []) {
    if (["yaml", "definition", "footnoteDefinition"].includes(section.type)) continue;
    const block = blocks[blockIndex++];
    const selector = SECTION_SELECTORS[section.type];
    // Do not invent positions for content transformed by other plugins.
    if (!block || !selector || !block.matches(selector) || !block.instanceOf(HTMLElement)) continue;
    const start = section.position.start.line;
    const end = section.position.end.line;
    if (section.type === "list") {
      const items = (cache?.listItems ?? []).filter((item) =>
        item.position.start.line >= start && item.position.start.line <= end
      );
      for (const [index, item] of Array.from(block.querySelectorAll<HTMLElement>("li")).entries()) {
        const position = items[index]?.position;
        if (!position) continue;
        const targets = textTargets(item).filter((target) => target.closest("li") === item);
        numberTargets(targets.length ? targets : [item], position.start.line, position.end.line);
      }
    } else if (["paragraph", "heading", "blockquote", "callout"].includes(section.type)) {
      const firstLine = section.type === "callout" ? start + 1 : start;
      const targets = textTargets(block);
      numberTargets(targets.length ? targets : [block], firstLine, end);
    } else {
      setNumber(block, start + 1);
    }
  }

  function numberTargets(targets: HTMLElement[], start: number, end: number): void {
    let line = start;
    for (const target of targets) {
      while (line <= end && /^\s*(?:>\s*)*$/.test(sourceLines[line] ?? "")) line++;
      if (line > end) break;
      setNumber(target, line++ + 1);
    }
  }
}

function textTargets(block: HTMLElement): HTMLElement[] {
  const candidates = [block, ...block.querySelectorAll<HTMLElement>(".jst-source-line, p, li, h1, h2, h3, h4, h5, h6")];
  return candidates.filter((element) =>
    !element.closest(".internal-embed, .external-embed, pre, .callout-title") &&
    (element.matches(".jst-source-line") ||
      (element.matches("p, li, h1, h2, h3, h4, h5, h6") &&
       !element.querySelector(".jst-source-line, p, ul, ol")))
  );
}

function setNumber(element: HTMLElement, number: number): void {
  element.dataset.jstLineNumber = String(number);
}
