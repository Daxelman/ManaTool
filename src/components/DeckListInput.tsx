import { useState } from "react";

type DeckListInputProps = {
  onSubmit: (deckList: string) => void;
  loading: boolean;
  loadingStatus: string;
};

const DeckListInput = ({
  onSubmit,
  loading,
  loadingStatus,
}: DeckListInputProps) => {
  const [inputList, setInputList] = useState("");

  return (
    <div className="flex flex-col items-center">
      <p className="text-center">
        Paste you deck below, hit the button, and we'll try and give you an
        optimized mana base.
      </p>
      <textarea
        className="border-grey h-105 w-125 rounded-md border backdrop-blur-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        value={inputList}
        onChange={(e) => setInputList(e.target.value)}
        placeholder={"4 Lightning Bolt\n2 Counterspell\n1 Sol Ring"}
        rows={12}
      />
      <br />
      <button
        className="mt-5 rounded border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-800 shadow hover:bg-gray-100"
        type="button"
        onClick={() => onSubmit(inputList)}
        disabled={loading}
      >
        {loading ? loadingStatus || "Checking cards..." : "Give Me Good Mana"}
      </button>
    </div>
  );
};

export default DeckListInput;
