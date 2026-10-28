const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => {
  return (
    <div className="w-full max-w-xs rounded-lg bg-[#3A3546] p-4 shadow-md">
      <h3 className="text-lg font-semibold text-[#CFCCD8]">{label}</h3>
      <p className="text-2xl font-bold text-[#CFCCD8]">{value}</p>
    </div>
  );
};
