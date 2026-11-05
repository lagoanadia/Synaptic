// Tech/AI headlines from public RSS/Atom feeds. Parsing is a few regexes
// on purpose: we only need title, link, date and a short summary, and a
// full XML library would be heavier than the whole feature.

export type Headline = {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string | null;
};

export const FEEDS: { source: string; url: string }[] = [
  { source: "Hacker News", url: "https://hnrss.org/frontpage?points=150" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]).trim() : "";
}

export function parseFeed(xml: string, source: string, limit = 15): Headline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return items
    .slice(0, limit)
    .map((block) => {
      // Atom puts the URL in <link href="…"/>; RSS between <link> tags.
      const atomLink = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) ?? block.match(/<link[^>]*href="([^"]+)"/i);
      const url = tag(block, "link") || (atomLink ? decode(atomLink[1]) : "");
      const summary = stripTags(decode(tag(block, "description") || tag(block, "summary") || tag(block, "content")))
        // Hacker News "descriptions" are just link/points metadata.
        .replace(/^Article URL:.*$/s, "");
      const date = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
      const parsed = date ? new Date(date) : null;
      return {
        title: stripTags(decode(tag(block, "title"))),
        url,
        source,
        summary: summary.length > 280 ? `${summary.slice(0, 277)}…` : summary,
        publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      };
    })
    .filter((h) => h.title && /^https?:\/\//.test(h.url));
}

// Newest first, one title per story (the same news shows up in several feeds).
export function mergeHeadlines(lists: Headline[][], limit = 25): Headline[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .filter((h) => {
      const key = h.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function fetchHeadlines(): Promise<Headline[]> {
  const lists = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          next: { revalidate: 3600 },
          headers: { "User-Agent": "Synaptic headlines reader" },
          signal: AbortSignal.timeout(6000),
        });
        return res.ok ? parseFeed(await res.text(), f.source) : [];
      } catch {
        return [];
      }
    }),
  );
  return mergeHeadlines(lists);
}
