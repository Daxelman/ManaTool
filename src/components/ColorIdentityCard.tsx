import ColorChip from "./ColorChip";

const ColorIdentityCard = ({ colorIdentity }: { colorIdentity: string[] }) => {
  return (
    <div className="flex h-22.5 w-53.5 flex-col items-start justify-start gap-1.5 rounded-lg bg-[#3A3546] px-5 py-4 shadow-lg outline-1 outline-[#4D475C]">
      <p className="text-xs font-semibold text-[#CFCCD8]">COLOR IDENTITY</p>
      <div className="flex items-center gap-1.5">
        {colorIdentity.map((color) => (
          <ColorChip key={color} color={color} />
        ))}
      </div>
    </div>
  );
};

export default ColorIdentityCard;
