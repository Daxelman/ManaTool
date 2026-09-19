import { useState } from "react";
import { lookupCards } from "../../services/cardLookup";
import { getRampAndDrawNames } from "../../services/tagLookup";
import type { ScryfallCard } from "../../types/scryfall";
import { ManaBreakdown, optimizeMana } from "../../services/optimizer";
import { Button } from "../../components/ui/button";

type CardEntry = {
  quantity: number;
  name: string;
};

const BASIC_LAND_NAMES: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

type ValidationResult = {
  found: (CardEntry & { data: ScryfallCard })[];
  notFound: CardEntry[];
};

function parseList(raw: string): CardEntry[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .map((line) => {
      const match = line.match(/^(\d+)x?\s+(.+)$/);
      if (!match) return null;
      return { quantity: parseInt(match[1]), name: match[2].trim() };
    })
    .filter((entry): entry is CardEntry => entry !== null);
}

const Home = () => {
  const [inputList, setInputList] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manaBreakdown, setManaBreakdown] = useState<ManaBreakdown | null>(
    null,
  );

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    const parsed = parseList(inputList);
    if (parsed.length === 0) {
      setError("No valid card entries found. Use the format: 4 Lightning Bolt");
      return;
    }
    setLoading(true);
    try {
      const { found, notFound } = await lookupCards(
        parsed.map((c) => c.name),
        setLoadingStatus,
      );
      const foundCards = found.map(({ name, data }) => ({
        ...(parsed.find(
          (c) => c.name.toLowerCase() === name.toLocaleLowerCase(),
        ) ?? { quantity: 1, name }),
        data,
      }));
      setResult({
        found: foundCards,
        notFound: notFound.map((name) => ({ quantity: 0, name })),
      });

      // Tag data sharpens the ramp/draw count; if Scryfall is unreachable the
      // optimizer falls back to its oracle-text heuristic.
      const rampAndDrawNames = await getRampAndDrawNames(setLoadingStatus).catch(
        () => undefined,
      );
      setManaBreakdown(optimizeMana(foundCards, rampAndDrawNames));
    } catch (error) {
      console.log(error);
      setError(
        "Failed to load card data. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div>
        <h1>Optimize Your Mana</h1>
        <p>
          Paste you deck below, hit the button, and we'll try and give you an
          optimized mana base.
        </p>
      </div>
      <div>
        <textarea
          value={inputList}
          onChange={(e) => setInputList(e.target.value)}
          placeholder={"4 Lightning Bolt\n2 Counterspell\n1 Sol Ring"}
          rows={12}
        />
        <Button type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? loadingStatus || "Checking cards..." : "Give Me Good Mana"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && manaBreakdown && (
        <div>
          <h2>Mana Breakdown:</h2>
          <h3>
            Deck Color Identity: <b>{manaBreakdown.colorIdentity}</b>
          </h3>
          <h3>
            Current Land Count: <b>{manaBreakdown.landCount}</b>
          </h3>
          <h3>
            Current Non Land Count: <b>{manaBreakdown.nonLandCount}</b>
          </h3>
          <h3>
            Average Mana Value:{" "}
            <b>{manaBreakdown.averageManaValue.toFixed(2)}</b>
          </h3>
          <h3>
            Cheap Ramp / Draw Spells:{" "}
            <b>{manaBreakdown.rampAndDrawCount}</b>
          </h3>

          <h2>Recommended Mana Base</h2>
          <h3>
            Total Lands: <b>{manaBreakdown.recommendedLandCount}</b>{" "}
            ({manaBreakdown.recommendedBasicCount} basics,{" "}
            {manaBreakdown.recommendedNonBasicCount} non-basics)
          </h3>

          <h2>So I think You Need (at least) these Basics:</h2>
          {Object.keys(manaBreakdown.basicsNeeded).length > 0 ? (
            <ul>
              {(
                Object.entries(manaBreakdown.basicsNeeded) as [
                  string,
                  number,
                ][]
              ).map(([color, count]) => (
                <li key={color}>
                  {BASIC_LAND_NAMES[color] ?? color}: <b>{count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <h5>(no colored mana requirements found)</h5>
          )}

          {result.notFound.length > 0 && (
            <>
              <h2>Card(s) Not Recognized ({result.notFound.length})</h2>
              <ul className="text-red-600">
                {result.notFound.map((card) => (
                  <li key={card.name}>{card.name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
