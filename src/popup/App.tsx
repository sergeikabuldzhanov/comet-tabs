import { useEffect, useState } from "react";
import { useTabStore } from "./store";
import useDebounce from "./useDebounce";
import TabGroup from "./components/TabGroup";
import { TabGroup as TabGroupType } from "./types";
import { SearchIcon, InfoIcon } from "./components/Icons";

function App() {
  // Local UI state for virtual group collapse status
  const [isUngroupedCollapsed, setIsUngroupedCollapsed] = useState(true); // Start collapsed
  const [isSearchResultsCollapsed, setIsSearchResultsCollapsed] =
    useState(false); // Start expanded

  const {
    fetchTabs,
    tabs,
    tabGroups,
    loading,
    searchQuery,
    searchTabs,
    searchResults,
  } = useTabStore();

  const debouncedSearch = useDebounce(searchTabs, 300);

  useEffect(() => {
    // Fetch tabs when component mounts
    fetchTabs();

    // Setup tab event listeners
    const tabUpdateListener = () => {
      fetchTabs();
    };

    chrome.tabs.onCreated.addListener(tabUpdateListener);
    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onRemoved.addListener(tabUpdateListener);
    chrome.tabGroups.onCreated.addListener(tabUpdateListener);
    chrome.tabGroups.onUpdated.addListener(tabUpdateListener);
    chrome.tabGroups.onRemoved.addListener(tabUpdateListener);

    return () => {
      chrome.tabs.onCreated.removeListener(tabUpdateListener);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onRemoved.removeListener(tabUpdateListener);
      chrome.tabGroups.onCreated.removeListener(tabUpdateListener);
      chrome.tabGroups.onUpdated.removeListener(tabUpdateListener);
      chrome.tabGroups.onRemoved.removeListener(tabUpdateListener);
    };
  }, [fetchTabs]);

  // Create a virtual group for ungrouped tabs
  const ungroupedTabs = tabs.filter(
    (tab) =>
      tab.groupId === undefined ||
      tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE,
  );
  const ungroupedGroup: TabGroupType = {
    id: -1,
    collapsed: false,
    color: "grey",
    windowId: -1,
    tabs: ungroupedTabs,
  };

  return (
    <div className="min-h-64 min-w-96 p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comet Tabs ☄️</h1>
        <span className="badge badge-neutral">{tabs.length} tabs</span>
      </header>

      {/* Search Bar */}
      <div className="mb-4">
        <label className="input input-bordered flex w-full items-center gap-2">
          <SearchIcon className="h-4 w-4 opacity-70" />
          <input
            type="search"
            className="grow"
            placeholder="Search tabs"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        {/* Search Results - Rendered as a collapsible TabGroup */}
        {searchQuery && searchResults.length > 0 && (
          <TabGroup
            key="search-results"
            group={{
              id: -2, // Special ID for virtual search group
              collapsed: false, // Not used directly, controlled by state
              color: "grey", // Use a valid ColorEnum
              windowId: -1, // Not relevant for virtual group
              title: `Search Results`,
              tabs: searchResults,
            }}
            isCollapsedOverride={isSearchResultsCollapsed}
            onToggleCollapseOverride={() =>
              setIsSearchResultsCollapsed((prev) => !prev)
            }
          />
        )}

        {/* No Search Results Message */}
        {searchQuery && searchResults.length === 0 && (
          <div className="alert alert-info">
            <InfoIcon className="h-6 w-6 shrink-0 stroke-current" />
            <span>No results found for "{searchQuery}"</span>
          </div>
        )}

        {/* Tab Groups Section */}
        {/* Display Tab Groups */}
        {tabGroups.map((group) => (
          <TabGroup key={group.id} group={group} />
        ))}

        {/* Display Ungrouped Tabs */}
        {ungroupedTabs.length > 0 && (
          <TabGroup
            key="ungrouped"
            group={ungroupedGroup}
            isUngroupedSection={true}
            isCollapsedOverride={isUngroupedCollapsed}
            onToggleCollapseOverride={() =>
              setIsUngroupedCollapsed((prev) => !prev)
            }
          />
        )}
      </div>

      {/* Empty State */}
      {!loading && tabs.length === 0 && (
        <div className="alert">
          <InfoIcon className="stroke-info h-6 w-6 shrink-0" />
          <span>No tabs open. Try opening some tabs!</span>
        </div>
      )}
    </div>
  );
}

export default App;
