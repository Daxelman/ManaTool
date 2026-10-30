import localforage from "localforage";
import type { ScryfallCard } from "../types/scryfall";

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

// Deserializing the whole card map out of IndexedDB costs ~200ms, so keep it
// for the rest of the page's life. Staleness is still checked against the
// IndexedDB metadata on every lookup, so a week-old map is still replaced.
let memoryCardMap: CardMap | null = null;

async function isStale(): Promise<boolean> {
  const meta = await store.getItem<CacheMeta>(META_KEY);
  if (!meta || meta.schemaVersion !== SCHEMA_VERSION) return true;
  return Date.now() - meta.downloadedAt > TTL_MS;
}

function indexLine(map: CardMap, line: string): void {
  if (!line) return;
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

async function populate(
  onProgress: (status: string) => void,
): Promise<CardMap> {
  onProgress("Fetching card database info...");
  const metaRes = await fetch(
    "https://api.scryfall.com/bulk-data/oracle-cards",
  );
  const { jsonl_download_uri } = await metaRes.json();
  if (!jsonl_download_uri) {
    throw new Error(
      "Scryfall bulk-data metadata didn't include a jsonl_download_uri — their API may have changed again.",
    );
  }

  // The bulk file is gzip-compressed JSON Lines (one card object per line),
  // not a single JSON array, and Scryfall doesn't set Content-Encoding, so
  // fetch() won't auto-decompress it — we have to gunzip it ourselves.
  onProgress("Downloading card database (one-time setup, ~25MB)...");
  const dataRes = await fetch(jsonl_download_uri);

  // Streaming is the only viable path: the file is ~25MB gzipped but ~210MB
  // decompressed, so buffering it whole would need roughly half a gigabyte.
  // Download, gunzip and parse overlap instead, 64KB at a time.
  if (typeof DecompressionStream === "undefined" || !dataRes.body) {
    throw new Error(
      "This browser can't stream-decompress the card database. Needs Chrome 80+, Firefox 113+, or Safari 16.4+.",
    );
  }

  const cardMap: CardMap = {};
  const reader = dataRes.body
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let tail = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = (tail + value).split("\n");
    tail = lines.pop() ?? "";
    for (const line of lines) indexLine(cardMap, line);
  }
  indexLine(cardMap, tail);

  await store.setItem(CARD_MAP_KEY, cardMap);
  await store.setItem(META_KEY, {
    downloadedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
  } as CacheMeta);

  memoryCardMap = cardMap;
  return cardMap;
}

export type LookupResult = {
  found: { name: string; data: ScryfallCard }[];
  notFound: string[];
};

export async function lookupCards(
  names: string[],
  onProgress: (status: string) => void,
): Promise<LookupResult> {
  let cardMap: CardMap;
  if (await isStale()) {
    cardMap = await populate(onProgress);
  } else if (memoryCardMap) {
    cardMap = memoryCardMap;
  } else {
    cardMap = (await store.getItem<CardMap>(CARD_MAP_KEY)) ?? {};
    memoryCardMap = cardMap;
  }

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
}
