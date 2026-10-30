const CHIP_STYLES: Record<string, string> = {
  W: "bg-[#F8E7B9] text-[#3a3546]",
  U: "bg-[#0E68AB] text-white",
  B: "bg-[#150B00] text-white",
  R: "bg-[#D3202A] text-white",
  G: "bg-[#00733E] text-white",
};

const ColorChip = ({ color }: { color: string }) => {
  return (
    <span
      className={`flex size-6 items-center justify-center rounded-xl text-xs font-bold ${CHIP_STYLES[color] ?? "bg-gray-400 text-white"}`}
    >
      {color}
    </span>
  );
};

export default ColorChip;
