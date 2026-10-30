import { ManaBreakdown } from "../services/optimizer";
import ColorIdentityCard from "./ColorIdentityCard";
import StatCard from "./StatCard";

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
    <div className="flex max-h-312.75 max-w-360 flex-col items-center justify-center gap-10">
      <p className="jus">Deck Breakdown:</p>
      <div>
        <div className="grid items-start gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <ColorIdentityCard colorIdentity={manaBreakdown.colorIdentity} />
          <StatCard label="LAND COUNT" value={manaBreakdown.landCount} />
          <StatCard label="NON-LAND COUNT" value={manaBreakdown.nonLandCount} />
          <StatCard
            label="AVG MANA VALUE"
            value={manaBreakdown.averageManaValue.toFixed(2)}
          />
          <StatCard
            label="CHEAP RAMP / DRAW"
            value={manaBreakdown.rampAndDrawCount}
          />
        </div>
      </div>

      <h1>Recommended Mana Base:</h1>
      <h3>
        Total Lands: <b>{manaBreakdown.recommendedLandCount}</b> (
        {manaBreakdown.recommendedBasicCount} basics,{" "}
        {manaBreakdown.recommendedLandCount -
          manaBreakdown.recommendedBasicCount}{" "}
        non-basics)
      </h3>

      <h1>So I think You Need (at least) these Basics:</h1>
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
