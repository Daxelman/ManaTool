import localforage from "localforage";

// Scryfall "oracle tags" (aka function tags) come from the community Tagger
// project (tagger.scryfall.com). They are queryable only through the search
// API via otag:/function: — they are NOT in the bulk oracle-cards download
// that cardLookup.ts uses, so this needs its own cached fetch.

const store = localforage.createInstance({
  name: "mana-optimizer",
  storeName: "tags",
});

const API = "https://api.scryfall.com";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week, matching the card cache
const RATE_LIMIT_MS = 100; // Scryfall asks for 50–100ms between requests

// "cheap card draw or mana ramp spells" from Karsten's land-count formula.
// mv<=2 keeps it to the "cheap" bucket and holds the download to a few pages.
const RAMP_AND_DRAW_QUERY = "(otag:ramp or otag:cantrip) mv<=2";
const CACHE_KEY = "ramp-and-draw";

type TagCache = { fetchedAt: number; names: string[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTaggedNames(query: string): Promise<string[]> {
  const names: string[] = [];
  let url: string | null = `${API}/cards/search?q=${encodeURIComponent(
    query,
  )}&unique=cards`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) break; // the query matched nothing
    if (!res.ok) {
      throw new Error(`Scryfall tag search failed: ${res.status}`);
    }

    const page: {
      data: { name: string }[];
      has_more: boolean;
      next_page: string | null;
    } = await res.json();

    for (const card of page.data) {
      // Split / double-faced cards come back as "Front // Back" — index every
      // face so a decklist entry for either side still matches.
      for (const face of card.name.split(" // ")) {
        names.push(face.toLowerCase());
      }
    }

    url = page.has_more ? page.next_page : null;
    if (url) await sleep(RATE_LIMIT_MS);
  }

  return Array.from(new Set(names));
}

/**
 * Set of lowercased card names tagged as cheap ramp or card draw, for
 * `optimizeMana`'s ramp discount. Cached in IndexedDB for a week; a failed
 * refresh falls back to a stale cache, and a total failure throws so callers
 * can decide whether to continue without it.
 */
export async function getRampAndDrawNames(
  onProgress?: (status: string) => void,
): Promise<Set<string>> {
  const cached = await store.getItem<TagCache>(CACHE_KEY);
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) return new Set(cached.names);

  onProgress?.("Fetching ramp / card-draw tags from Scryfall...");
  try {
    const names = await fetchTaggedNames(RAMP_AND_DRAW_QUERY);
    await store.setItem(CACHE_KEY, {
      fetchedAt: Date.now(),
      names,
    } as TagCache);
    return new Set(names);
  } catch (err) {
    if (cached) return new Set(cached.names); // stale is better than nothing
    throw err;
  }
}
