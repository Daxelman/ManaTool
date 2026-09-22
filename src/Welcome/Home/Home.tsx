import { useState } from "react";
import "./Home.css";
import { lookupCards } from "../../services/cardLookup";
import { getRampAndDrawNames } from "../../services/tagLookup";
import type { ScryfallCard } from "../../types/scryfall";
import { ManaBreakdown, optimizeMana } from "../../services/optimizer";
import DeckListInput from "../../Components/DeckListInput";
import ManaBreakdownSection from "../../Components/ManaBreakdownSection";

type CardEntry = {
  quantity: number;
  name: string;
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
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manaBreakdown, setManaBreakdown] = useState<ManaBreakdown | null>(
    null,
  );

  const handleSubmit = async (deckList: string) => {
    setError(null);
    setResult(null);
    const parsed = parseList(deckList);
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
      const rampAndDrawNames = await getRampAndDrawNames(
        setLoadingStatus,
      ).catch(() => undefined);
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
    <div>
      <div>
        <p>
          Paste you deck below, hit the button, and we'll try and give you an
          optimized mana base.
        </p>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="md:w-1/2">
          <div>
            <DeckListInput
              onSubmit={handleSubmit}
              loading={loading}
              loadingStatus={loadingStatus}
            />
          </div>
        </div>
        <div className="md:w-1/2">
          {result && manaBreakdown && (
            <div>
              <ManaBreakdownSection manaBreakdown={manaBreakdown} />
              {result.notFound.length > 0 && (
                <>
                  <h2>Card(s) Not Recognized ({result.notFound.length})</h2>
                  <ul className="not-found-list">
                    {result.notFound.map((card) => (
                      <li key={card.name}>{card.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
