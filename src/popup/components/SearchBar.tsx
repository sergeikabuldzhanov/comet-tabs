import { SearchIcon } from "./Icons";
import { memo } from "react";

const SearchBar: React.FC<{
  inputValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ inputValue, onChange }) => {
  return (
    <label className="group relative flex items-center gap-2">
      <SearchIcon className="h-4 text-neutral-400" />
      <input
        type="search"
        value={inputValue}
        onChange={onChange}
        placeholder="Search Tabs"
        className="flex-grow text-white placeholder-neutral-500 outline-none [&::-webkit-search-cancel-button]:hidden"
        autoFocus
      />
      <span className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-xs text-neutral-400 group-focus-within:hidden">
        Alt+A
      </span>
    </label>
  );
};

export default memo(SearchBar);
