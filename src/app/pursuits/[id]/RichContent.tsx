import { parseNoteBlocks, type InlineNode, type ListBlock, type ListItem, type NoteBlock } from "@/lib/text";
import { CodeBlock } from "./CodeBlock";

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "bold":
            return <strong key={i}>{n.value}</strong>;
          case "italic":
            return <em key={i}>{n.value}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-chip px-1 py-px font-mono text-[0.88em]">
                {n.value}
              </code>
            );
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

// Nested bullets cycle disc → circle → square by depth.
function bulletStyleForDepth(depth: number): string {
  return depth === 0 ? "disc" : depth === 1 ? "circle" : "square";
}

function ListItems({ items, depth }: { items: ListItem[]; depth: number }) {
  return (
    <>
      {items.map((item, j) => (
        <li key={j} className="whitespace-pre-line">
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
        <ol start={block.start} className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
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

// Renders stored content (headings, callouts, lists, tables, code, images).
export function RichContent({
  content,
  paragraphClassName = "text-base leading-relaxed whitespace-pre-wrap",
}: {
  content: string;
  paragraphClassName?: string;
}) {
  return <Blocks blocks={parseNoteBlocks(content)} paragraphClassName={paragraphClassName} />;
}

function Blocks({ blocks, paragraphClassName }: { blocks: NoteBlock[]; paragraphClassName: string }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "pdf":
            return (
              <a key={i} href={block.url} target="_blank" rel="noopener noreferrer" className="flex w-full max-w-[340px] items-center gap-3 rounded-xl bg-chip px-4 py-3 font-bold tracking-tight uppercase hover:bg-hover">
                <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] tracking-wider text-white">PDF</span>
                <span className="min-w-0 truncate">{block.title || "PDF"}</span>
              </a>
            );
          case "image":
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={block.url}
                alt="Adjunto"
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
              <div key={i} className={`callout callout-${block.color ?? "yellow"}`}>
                <span className="callout-emoji" aria-hidden>{block.emoji ?? "💡"}</span>
                <p className="min-w-0 flex-1 leading-relaxed">
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
              <p key={i} className={paragraphClassName} style={block.indent ? { marginLeft: `${block.indent * 1.75}em` } : undefined}>
                <Inline nodes={block.inline} />
              </p>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm leading-relaxed">
                  {block.header.length > 0 && (
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
                  )}
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
            return <CodeBlock key={i} code={block.code} language={block.language} />;
          case "columns":
            return (
              <div key={i} className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": block.cols.length } as React.CSSProperties}>
                {block.cols.map((col, j) => (
                  <Blocks key={j} blocks={col} paragraphClassName={paragraphClassName} />
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
