import { describe, expect, it } from "vitest";
import { decode, mergeHeadlines, parseFeed } from "./feeds";

const RSS = `<?xml version="1.0"?><rss><channel><title>X</title>
<item><title><![CDATA[OpenAI &amp; friends ship a thing]]></title><link>https://ex.com/a</link>
<pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Big &lt;b&gt;news&lt;/b&gt; today&lt;/p&gt;</description></item>
<item><title>No link item</title></item>
</channel></rss>`;

const ATOM = `<feed><entry><title type="html">Chips &#8211; again</title>
<link rel="alternate" type="text/html" href="https://ex.com/b"/><updated>2026-11-04T09:00:00Z</updated>
<summary>Short</summary></entry></feed>`;

describe("feeds", () => {
  it("parses RSS with CDATA, entities and HTML in descriptions", () => {
    expect(parseFeed(RSS, "Src")).toEqual([
      {
        title: "OpenAI & friends ship a thing",
        url: "https://ex.com/a",
        source: "Src",
        summary: "Big news today",
        publishedAt: "2026-11-03T10:00:00.000Z",
      },
    ]);
  });
  it("parses Atom links and dates", () => {
    const [h] = parseFeed(ATOM, "Verge");
    expect(h.title).toBe("Chips – again");
    expect(h.url).toBe("https://ex.com/b");
    expect(h.publishedAt).toBe("2026-11-04T09:00:00.000Z");
  });
  it("drops Hacker News metadata posing as a summary", () => {
    const hn = `<rss><item><title>Show HN: X</title><link>https://x.dev</link><description>&lt;p&gt;Article URL: &lt;a href="https://x.dev"&gt;x&lt;/a&gt;&lt;/p&gt; Points: 5</description></item></rss>`;
    expect(parseFeed(hn, "Hacker News")[0].summary).toBe("");
  });
  it("decodes numeric entities", () => {
    expect(decode("it&#39;s &#x2014; ok")).toBe("it's — ok");
  });
  it("merges newest first and drops duplicate stories", () => {
    const a = { title: "Same Story!", url: "https://a", source: "A", summary: "", publishedAt: "2026-11-01T00:00:00Z" };
    const b = { ...a, title: "same story", url: "https://b", source: "B", publishedAt: "2026-11-02T00:00:00Z" };
    const c = { ...a, title: "Other", url: "https://c", publishedAt: "2026-11-03T00:00:00Z" };
    expect(mergeHeadlines([[a, c], [b]]).map((h) => h.url)).toEqual(["https://c", "https://b"]);
  });
});

import { debateStats, type Verdict } from "./debate";

describe("debateStats", () => {
  const v = (winner: Verdict["winner"], logic: number, fallacies: string[]): Verdict => ({
    winner,
    scores: { clarity: 3, evidence: 2, logic, responsiveness: 4 },
    strongest: "", weakest: "", steelman: "", rethink: "", readMore: [],
    fallacies: fallacies.map((name) => ({ name, quote: "" })),
  });
  it("averages scores and ranks repeated fallacies", () => {
    const s = debateStats([v("you", 4, ["Straw man"]), v("ai", 2, ["straw man", "Slippery slope"])]);
    expect(s).toMatchObject({ debates: 2, wins: 1, averages: { logic: 3 } });
    expect(s.topFallacies[0]).toEqual({ name: "straw man", n: 2 });
  });
  it("handles no debates", () => {
    expect(debateStats([]).averages.logic).toBe(0);
  });
});
