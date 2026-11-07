import { describe, expect, it } from "vitest";
import { parsePrompt } from "./PromptText";

describe("parsePrompt", () => {
  it("pulls a glued example out into a code block", () => {
    const blocks = parsePrompt('Return the total. Example: totalExpiring([{name:"Milk",qty:2}],3,"2023-01-01") ⇒ 2.');
    expect(blocks).toEqual([
      { kind: "text", text: "Return the total." },
      { kind: "code", text: 'totalExpiring([{name:"Milk",qty:2}],3,"2023-01-01") ⇒ 2.' },
    ]);
  });
  it("reads fenced code, lists and plain paragraphs", () => {
    const blocks = parsePrompt("Suma las cantidades.\n\n**Recibe:**\n\n- `items`: la despensa\n- `days`: días\n\n```\nf([], 3) → 0\n```");
    expect(blocks.map((b) => b.kind)).toEqual(["text", "text", "list", "code"]);
    expect(blocks[2]).toEqual({ kind: "list", items: ["`items`: la despensa", "`days`: días"] });
  });
});
