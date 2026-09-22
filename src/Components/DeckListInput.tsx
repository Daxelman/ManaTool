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
    <div>
      <textarea
        className="w-100 backdrop-blur-md"
        value={inputList}
        onChange={(e) => setInputList(e.target.value)}
        placeholder={"4 Lightning Bolt\n2 Counterspell\n1 Sol Ring"}
        rows={12}
      />
      <br />
      <button
        className="rounded border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-800 shadow hover:bg-gray-100"
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
