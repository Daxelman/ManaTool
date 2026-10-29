const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => {
  return (
    <div className="flex h-22.5 w-53.5 flex-col items-start justify-start gap-1.5 rounded-lg bg-[#3A3546] px-5 py-4 shadow-lg outline-1 outline-[#4D475C]">
      <p className="text-xs font-semibold text-[#CFCCD8]">{label}</p>
      <p className="text-2xl font-bold text-[#CFCCD8]">{value}</p>
    </div>
  );
};

export default StatCard;
