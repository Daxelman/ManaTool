import localforage from "localforage";
import { ungzip } from "pako";
import type { ScryfallCard } from "../types/scryfall";
import { timed } from "./perf";

const store = localforage.createInstance({
  name: "mana-optimizer",
  storeName: "cards",
});

const CARD_MAP_KEY = "card-map";
const META_KEY = "cache-meta";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
// Bump when the cached card shape changes so old caches repopulate before TTL.
const SCHEMA_VERSION = 2;

type CardMap = Record<string, ScryfallCard>;
type CacheMeta = { downloadedAt: number; schemaVersion?: number };

async function isStale(): Promise<boolean> {
  const meta = await store.getItem<CacheMeta>(META_KEY);
  if (!meta || meta.schemaVersion !== SCHEMA_VERSION) return true;
  return Date.now() - meta.downloadedAt > TTL_MS;
}

async function populate(onProgress: (status: string) => void): Promise<void> {
  onProgress("Fetching card database info...");
  const { jsonl_download_uri } = await timed("cards: bulk-data metadata", async () => {
    const metaRes = await fetch(
      "https://api.scryfall.com/bulk-data/oracle-cards",
    );
    return metaRes.json();
  });
  if (!jsonl_download_uri) {
    throw new Error(
      "Scryfall bulk-data metadata didn't include a jsonl_download_uri — their API may have changed again.",
    );
  }

  // The bulk file is gzip-compressed JSON Lines (one card object per line),
  // not a single JSON array, and Scryfall doesn't set Content-Encoding, so
  // fetch() won't auto-decompress it — we have to gunzip it ourselves.
  onProgress("Downloading card database (one-time setup, ~70MB)...");
  const compressed = await timed("cards: download", async () => {
    const dataRes = await fetch(jsonl_download_uri);
    return new Uint8Array(await dataRes.arrayBuffer());
  });

  onProgress("Decompressing card database...");
  const jsonl = await timed("cards: gunzip", () =>
    ungzip(compressed, { toText: true }),
  );

  onProgress("Indexing cards...");
  const cardMap = await timed("cards: parse + index", () => {
    const map: CardMap = {};
    for (const line of jsonl.split("\n")) {
      if (!line) continue;
      const card: ScryfallCard = JSON.parse(line);
      map[card.name.toLowerCase()] = {
        name: card.name,
        mana_cost: card.mana_cost,
        oracle_text: card.oracle_text ?? "",
        cmc: card.cmc,
        type_line: card.type_line,
        colors: card.colors,
        color_identity: card.color_identity,
        legalities: card.legalities,
      };
    }
    return map;
  });

  await timed("cards: IndexedDB write", async () => {
    await store.setItem(CARD_MAP_KEY, cardMap);
    await store.setItem(META_KEY, {
      downloadedAt: Date.now(),
      schemaVersion: SCHEMA_VERSION,
    } as CacheMeta);
  });
}

export type LookupResult = {
  found: { name: string; data: ScryfallCard }[];
  notFound: string[];
};

export async function lookupCards(
  names: string[],
  onProgress: (status: string) => void,
): Promise<LookupResult> {
  return timed("cards: lookupCards total", async () => {
    if (await timed("cards: staleness check", isStale)) {
      await timed("cards: populate total", () => populate(onProgress));
    }

    const cardMap = await timed(
      "cards: IndexedDB read",
      async () => (await store.getItem<CardMap>(CARD_MAP_KEY)) ?? {},
    );
    const found: LookupResult["found"] = [];
    const notFound: string[] = [];

    for (const name of names) {
      const card = cardMap[name.toLowerCase()];
      if (card) {
        found.push({ name, data: card });
      } else {
        notFound.push(name);
      }
    }

    return { found, notFound };
  });
}
