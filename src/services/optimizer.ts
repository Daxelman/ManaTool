import type { ScryfallCard } from "../types/scryfall";

export type ManaColor = "W" | "U" | "B" | "R" | "G";

export type ManaBreakdown = {
  colorIdentity: ManaColor[];
  /** Lands currently in the pasted list. */
  landCount: number;
  /** Non-land cards currently in the pasted list. */
  nonLandCount: number;
  /** Average mana value of the non-land cards. */
  averageManaValue: number;
  /** Cheap (MV <= 2) card-draw or mana-ramp spells detected in the list. */
  rampAndDrawCount: number;
  /** Total lands the deck should run, per the land-count formula. */
  recommendedLandCount: number;
  /** How many of the recommended lands should be basics. */
  recommendedBasicCount: number;
  /** Recommended lands that should be non-basic (duals / fetches / utility). */
  recommendedNonBasicCount: number;
  /** Recommended basics split by color, proportional to colored pip demand. */
  basicsNeeded: Partial<Record<ManaColor, number>>;
};

export type DeckCard = {
  quantity: number;
  name: string;
  data: ScryfallCard;
};

/*
Land-count formula, from:
https://www.tcgplayer.com/content/article/How-Many-Lands-Do-You-Need-in-Your-Deck-An-Updated-Analysis/

Karsten's 60-card formula, scaled to a 99-card Commander deck:

  = 99/60 * (19.59 + 1.90 * average mana value + 0.27)
      - 0.28 * number of cheap card draw or mana ramp spells - 1.35
  = 31.42 + 3.13 * average mana value - 0.28 * number of cheap draw/ramp spells

Basic-land share shrinks as the deck adds colors. Fitting B = k / n^p to the
midpoints of these ranges (with a ~37-land baseline, so k/37 ~= 0.68) lands on
p ~= 0.9:

  mono colored        = 20-30 basic lands
  dual colored        = 10-18 basic lands
  tri colored         =  8-14 basic lands
  four/five colored   =   2-8 basic lands

  recommendedBasics = recommendedLands * 0.68 / colorCount^0.9
*/

// Land-count formula coefficients.
const LAND_BASE = 31.42;
const LAND_MV_COEFF = 3.13;
const LAND_RAMP_COEFF = 0.28;
const LAND_MIN = 30;
const LAND_MAX = 42;

// Basic-land share: baseline fraction of lands that are basics in a mono deck,
// and the exponent that decays that share as colors are added.
const BASIC_BASELINE_FRACTION = 0.68;
const COLOR_SCALING_EXPONENT = 0.9;

// A spell only counts toward the ramp/draw discount if it's this cheap.
const CHEAP_MV = 2;

export function optimizeMana(
  deck: DeckCard[],
  /**
   * Lowercased names of cards tagged as cheap ramp / card draw (from
   * `tagLookup.getRampAndDrawNames`). When omitted, `countRampAndDraw` falls
   * back to matching `oracle_text` with regexes.
   */
  rampAndDrawNames?: Set<string>,
): ManaBreakdown {
  const colorIdentity = getDeckColorIdentity(deck);
  const nonLands = deck.filter((card) => !isLand(card));

  const landCount = countCards(deck, isLand);
  const nonLandCount = countCards(deck, (card) => !isLand(card));
  const averageManaValue = getAverageManaValue(nonLands);
  const rampAndDrawCount = countRampAndDraw(nonLands, rampAndDrawNames);

  const recommendedLandCount = recommendLandCount(
    averageManaValue,
    rampAndDrawCount,
  );
  const recommendedBasicCount = recommendBasicCount(
    recommendedLandCount,
    colorIdentity.length,
  );
  const recommendedNonBasicCount =
    recommendedLandCount - recommendedBasicCount;

  const basicsNeeded = distributeBasics(
    nonLands,
    colorIdentity,
    recommendedBasicCount,
  );

  return {
    colorIdentity,
    landCount,
    nonLandCount,
    averageManaValue,
    rampAndDrawCount,
    recommendedLandCount,
    recommendedBasicCount,
    recommendedNonBasicCount,
    basicsNeeded,
  };
}

/** L = 31.42 + 3.13 * AMV - 0.28 * ramp, clamped to a sane Commander range. */
function recommendLandCount(
  averageManaValue: number,
  rampAndDrawCount: number,
): number {
  const raw =
    LAND_BASE +
    LAND_MV_COEFF * averageManaValue -
    LAND_RAMP_COEFF * rampAndDrawCount;
  return clamp(Math.round(raw), LAND_MIN, LAND_MAX);
}

/** recommendedBasics = L * 0.68 / colorCount^0.9 */
function recommendBasicCount(
  recommendedLandCount: number,
  colorCount: number,
): number {
  if (colorCount <= 0) return 0;
  const raw =
    (recommendedLandCount * BASIC_BASELINE_FRACTION) /
    Math.pow(colorCount, COLOR_SCALING_EXPONENT);
  return clamp(Math.round(raw), 0, recommendedLandCount);
}

/**
 * Split `total` basics across the deck's colors, proportional to how many
 * colored pips of each color the non-land spells ask for. Uses largest-remainder
 * rounding so the parts sum back to `total`.
 */
function distributeBasics(
  nonLands: DeckCard[],
  colors: ManaColor[],
  total: number,
): Partial<Record<ManaColor, number>> {
  const result: Partial<Record<ManaColor, number>> = {};
  if (total <= 0 || colors.length === 0) return result;

  const pips = getColorPips(nonLands);
  const relevant = colors.filter((c) => (pips[c] ?? 0) > 0);
  const pipSum = relevant.reduce((sum, c) => sum + pips[c], 0);
  if (pipSum === 0) return result;

  const exact = relevant.map((color) => ({
    color,
    value: (total * pips[color]) / pipSum,
  }));

  let assigned = 0;
  for (const entry of exact) {
    const floor = Math.floor(entry.value);
    result[entry.color] = floor;
    assigned += floor;
  }

  const leftover = total - assigned;
  exact.sort(
    (a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)),
  );
  for (let i = 0; i < leftover; i++) {
    const color = exact[i % exact.length].color;
    result[color] = (result[color] ?? 0) + 1;
  }

  return result;
}

/** Total colored pips per color across the non-land spells (qty-weighted). */
function getColorPips(nonLands: DeckCard[]): Record<ManaColor, number> {
  const pips: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };

  for (const card of nonLands) {
    const tokens = card.data.mana_cost?.match(/\{[^}]+\}/g) ?? [];
    for (const token of tokens) {
      // "{W}" -> ["W"], hybrid "{W/U}" -> ["W","U"], "{2/W}" / "{W/P}" -> ["W"]
      const parts = token
        .slice(1, -1)
        .split("/")
        .filter((p): p is ManaColor => /^[WUBRG]$/.test(p));
      if (parts.length === 0) continue;
      const weight = card.quantity / parts.length;
      for (const part of parts) pips[part] += weight;
    }
  }

  return pips;
}

function getAverageManaValue(nonLands: DeckCard[]): number {
  let totalMv = 0;
  let count = 0;
  for (const card of nonLands) {
    totalMv += card.data.cmc * card.quantity;
    count += card.quantity;
  }
  return count === 0 ? 0 : totalMv / count;
}

// Fallback heuristic for when Scryfall tag data isn't available: approximate
// "cheap card draw or mana ramp" from the oracle text. Catches mana rocks/dorks
// ("Add {C}", "Add one mana of any color"), land ramp ("Search your library for
// a ... land"), and straight card draw ("draw a card" / "draw two cards").
const RAMP_PATTERNS: RegExp[] = [
  /\badds?\s+\{[WUBRGCPXS/]*[WUBRGC]/i,
  /\badds?\s+(?:\w+\s+)?mana\b/i,
  /search your library for .{0,60}?\b(?:land|plains|island|swamp|mountain|forest)\b/i,
];
const DRAW_PATTERNS: RegExp[] = [
  /\bdraws?\s+(?:a card|\w+ cards|that many cards)\b/i,
];

function matchesRampOrDrawText(oracleText: string): boolean {
  return (
    RAMP_PATTERNS.some((re) => re.test(oracleText)) ||
    DRAW_PATTERNS.some((re) => re.test(oracleText))
  );
}

function countRampAndDraw(
  nonLands: DeckCard[],
  taggedNames?: Set<string>,
): number {
  let count = 0;
  for (const card of nonLands) {
    if (card.data.cmc > CHEAP_MV) continue;
    const isRampOrDraw = taggedNames
      ? taggedNames.has(card.data.name.toLowerCase())
      : matchesRampOrDrawText(card.data.oracle_text ?? "");
    if (isRampOrDraw) count += card.quantity;
  }
  return count;
}

function getDeckColorIdentity(deck: DeckCard[]): ManaColor[] {
  const identity = new Set<ManaColor>();
  deck.forEach((card) => {
    card.data.color_identity.forEach((color) =>
      identity.add(color as ManaColor),
    );
  });

  const colorOrder: Record<ManaColor, number> = { W: 1, U: 2, B: 3, R: 4, G: 5 };
  return Array.from(identity).sort((a, b) => colorOrder[a] - colorOrder[b]);
}

function isLand(card: DeckCard): boolean {
  return card.data.type_line.includes("Land");
}

function countCards(
  deck: DeckCard[],
  predicate: (card: DeckCard) => boolean,
): number {
  return deck
    .filter(predicate)
    .reduce((total, card) => total + card.quantity, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
