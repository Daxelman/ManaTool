import { optimizeMana, DeckCard } from "./optimizer";
import type { ScryfallCard } from "../types/scryfall";

function card(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    name: "Test Card",
    mana_cost: "",
    oracle_text: "",
    cmc: 0,
    type_line: "Creature",
    colors: [],
    color_identity: [],
    legalities: {},
    ...overrides,
  };
}

function entry(quantity: number, data: Partial<ScryfallCard>): DeckCard {
  return { quantity, name: data.name ?? "Test Card", data: card(data) };
}

const basic = (name: string, color: string) =>
  entry(1, {
    name,
    type_line: "Basic Land — " + name,
    color_identity: [color],
  });

describe("optimizeMana", () => {
  it("computes average mana value over non-lands only", () => {
    const deck: DeckCard[] = [
      entry(10, { cmc: 2, mana_cost: "{1}{G}" }),
      entry(10, { cmc: 4, mana_cost: "{2}{G}{G}" }),
      ...Array.from({ length: 30 }, () => basic("Forest", "G")),
    ];

    const result = optimizeMana(deck);

    expect(result.averageManaValue).toBeCloseTo(3);
    expect(result.nonLandCount).toBe(20);
    expect(result.landCount).toBe(30);
  });

  it("applies the land-count formula (31.42 + 3.13*AMV - 0.28*ramp)", () => {
    const deck: DeckCard[] = [
      entry(1, { cmc: 3, mana_cost: "{1}{G}{G}", color_identity: ["G"] }),
    ];

    // AMV 3, no ramp: 31.42 + 9.39 = 40.81 -> 41
    expect(optimizeMana(deck).recommendedLandCount).toBe(41);
  });

  it("counts cheap mana rocks as ramp via the oracle-text fallback", () => {
    const deck: DeckCard[] = [
      entry(1, { name: "Body", cmc: 3, mana_cost: "{2}{U}", color_identity: ["U"] }),
      entry(1, {
        name: "Sol Ring",
        cmc: 1,
        mana_cost: "{1}",
        type_line: "Artifact",
        oracle_text: "{T}: Add {C}{C}.",
      }),
    ];

    const result = optimizeMana(deck);
    expect(result.rampAndDrawCount).toBe(1);
  });

  it("uses the tagged-name set when provided instead of oracle text", () => {
    const deck: DeckCard[] = [
      // No oracle text, so the regex fallback would miss it.
      entry(1, { name: "Fellwar Stone", cmc: 2, type_line: "Artifact" }),
      entry(1, { name: "Big Spell", cmc: 5, mana_cost: "{5}" }),
    ];
    const tagged = new Set(["fellwar stone", "big spell"]);

    // Big Spell is tagged but MV 5, so it's still excluded as not "cheap".
    expect(optimizeMana(deck, tagged).rampAndDrawCount).toBe(1);
    // Without the set, Fellwar Stone (no oracle text) isn't detected.
    expect(optimizeMana(deck).rampAndDrawCount).toBe(0);
  });

  it("recommends fewer basics as the deck adds colors", () => {
    const mono = optimizeMana([
      entry(1, { cmc: 3, mana_cost: "{1}{G}{G}", color_identity: ["G"] }),
    ]);
    const four = optimizeMana([
      entry(1, {
        cmc: 3,
        mana_cost: "{W}{U}{B}{R}",
        color_identity: ["W", "U", "B", "R"],
      }),
    ]);

    expect(mono.recommendedBasicCount).toBeGreaterThan(
      four.recommendedBasicCount,
    );
    expect(
      mono.recommendedBasicCount + mono.recommendedNonBasicCount,
    ).toBe(mono.recommendedLandCount);
  });

  it("splits basics by colored pip demand and sums to the total", () => {
    const deck: DeckCard[] = [
      entry(9, { cmc: 1, mana_cost: "{G}", color_identity: ["G"] }),
      entry(3, { cmc: 1, mana_cost: "{W}", color_identity: ["W"] }),
    ];

    const { basicsNeeded, recommendedBasicCount } = optimizeMana(deck);
    const sum = Object.values(basicsNeeded).reduce((a, b) => a + b, 0);

    expect(sum).toBe(recommendedBasicCount);
    expect((basicsNeeded.G ?? 0)).toBeGreaterThan(basicsNeeded.W ?? 0);
  });
});
