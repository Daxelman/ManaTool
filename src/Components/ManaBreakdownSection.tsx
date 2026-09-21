import { ManaBreakdown } from "../services/optimizer";

type ManaBreakdownProps = {
  manaBreakdown: ManaBreakdown;
};

const BASIC_LAND_NAMES: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};
const ManaBreakdownSection = ({ manaBreakdown }: ManaBreakdownProps) => {
  return (
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
        Average Mana Value: <b>{manaBreakdown.averageManaValue.toFixed(2)}</b>
      </h3>
      <h3>
        Cheap Ramp / Draw Spells: <b>{manaBreakdown.rampAndDrawCount}</b>
      </h3>

      <h2>Recommended Mana Base</h2>
      <h3>
        Total Lands: <b>{manaBreakdown.recommendedLandCount}</b> (
        {manaBreakdown.recommendedBasicCount} basics,{" "}
        {manaBreakdown.recommendedNonBasicCount} non-basics)
      </h3>

      <h2>So I think You Need (at least) these Basics:</h2>
      {Object.keys(manaBreakdown.basicsNeeded).length > 0 ? (
        <ul>
          {(
            Object.entries(manaBreakdown.basicsNeeded) as [string, number][]
          ).map(([color, count]) => (
            <li key={color}>
              {BASIC_LAND_NAMES[color] ?? color}: <b>{count}</b>
            </li>
          ))}
        </ul>
      ) : (
        <h5>(no colored mana requirements found)</h5>
      )}
    </div>
  );
};

export default ManaBreakdownSection;
