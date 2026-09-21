import { useState } from "react";

type DeckListInputProps = {
  onSubmit: (deckList: string) => void;
  loading: boolean;
  loadingStatus: string;
};

const DeckListInput = ({ onSubmit, loading, loadingStatus }: DeckListInputProps) => {
  const [inputList, setInputList] = useState("");

  return (
    <div>
      <textarea
        value={inputList}
        onChange={(e) => setInputList(e.target.value)}
        placeholder={"4 Lightning Bolt\n2 Counterspell\n1 Sol Ring"}
        rows={12}
      />
      <button
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
