import { parseNoteBlocks, type InlineNode, type ListBlock, type ListItem } from "@/lib/text";

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "bold":
            return <strong key={i}>{n.value}</strong>;
          case "italic":
            return <em key={i}>{n.value}</em>;
          case "underline":
            return (
              <span key={i} className="underline">
                {n.value}
              </span>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:no-underline"
              >
                {n.text}
              </a>
            );
          case "text":
            return n.value;
        }
      })}
    </>
  );
}

// A nested bullet list cycles disc → circle → square by depth (the
// classic outliner convention) so a Tab-indented sub-point is visually
// distinct without needing a legend; numbered/lettered stay their own
// style at any depth since the marker CHARACTER itself already changes
// when a line gets nested (1. → a.).
function bulletStyleForDepth(depth: number): string {
  return depth === 0 ? "disc" : depth === 1 ? "circle" : "square";
}

function ListItems({ items, depth }: { items: ListItem[]; depth: number }) {
  return (
    <>
      {items.map((item, j) => (
        <li key={j}>
          <Inline nodes={item.inline} />
          {item.children.map((child, k) => (
            <ListBlockView key={k} block={child} depth={depth + 1} />
          ))}
        </li>
      ))}
    </>
  );
}

function ListBlockView({ block, depth }: { block: ListBlock; depth: number }) {
  switch (block.type) {
    case "bulletList":
      return (
        <ul
          className="space-y-1 pl-5 text-sm leading-relaxed"
          style={{ listStyleType: bulletStyleForDepth(depth) }}
        >
          <ListItems items={block.items} depth={depth} />
        </ul>
      );
    case "numberedList":
      return (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          <ListItems items={block.items} depth={depth} />
        </ol>
      );
    case "letteredList":
      return (
        <ol
          className="space-y-1 pl-5 text-sm leading-relaxed"
          style={{ listStyleType: "lower-alpha" }}
        >
          <ListItems items={block.items} depth={depth} />
        </ol>
      );
  }
}

const HEADING_TAG = { 1: "h2", 2: "h3", 3: "h4" } as const;
const HEADING_CLASS = {
  1: "text-xl font-bold",
  2: "text-lg font-semibold",
  3: "text-base font-semibold",
} as const;

// Renders the Notion-style shortcuts typed into a Brain Dump (or produced
// by Organize): `#`/`##`/`###` headings, `!` callouts, `-` bullets, `1.`
// numbered lists, `a.` lettered lists, `**bold**`, and inline images —
// used on both the Brain Dump detail page and Organized note cards so the
// same raw content renders the same way in both places.
export function RichContent({
  content,
  paragraphClassName = "text-base leading-relaxed whitespace-pre-wrap",
}: {
  content: string;
  paragraphClassName?: string;
}) {
  const blocks = parseNoteBlocks(content);

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "image":
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={block.url}
                alt="Attachment"
                className="max-w-full rounded-md border border-border-subtle"
              />
            );
          case "heading": {
            const Tag = HEADING_TAG[block.level];
            return (
              <Tag key={i} className={HEADING_CLASS[block.level]}>
                <Inline nodes={block.inline} />
              </Tag>
            );
          }
          case "callout":
            return (
              <div key={i} className="flex gap-3 rounded-md bg-callout p-4">
                <span className="text-ink-faint">▤</span>
                <p className="text-sm leading-relaxed">
                  <Inline nodes={block.inline} />
                </p>
              </div>
            );
          case "bulletList":
          case "numberedList":
          case "letteredList":
            return <ListBlockView key={i} block={block} depth={0} />;
          case "paragraph":
            return (
              <p key={i} className={paragraphClassName}>
                <Inline nodes={block.inline} />
              </p>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm leading-relaxed">
                  <thead>
                    <tr>
                      {block.header.map((cell, j) => (
                        <th
                          key={j}
                          className="border border-border-subtle bg-chip px-3 py-1.5 text-left font-semibold"
                        >
                          <Inline nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {block.rows.length > 0 && (
                    <tbody>
                      {block.rows.map((row, j) => (
                        <tr key={j}>
                          {row.map((cell, k) => (
                            <td key={k} className="border border-border-subtle px-3 py-1.5 align-top">
                              <Inline nodes={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            );
          case "codeBlock":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-md bg-ink px-4 py-3 text-sm leading-relaxed text-white"
              >
                <code>{block.code}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
