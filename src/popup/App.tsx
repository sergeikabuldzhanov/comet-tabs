import { useEffect, useCallback, useRef } from "react";
import { useTabStore } from "./store";
import { InfoIcon } from "./components/Icons";
import SearchBar from "./components/SearchBar";
import { VirtualizedTabList } from "./VirtualizedTabList";
import { VirtualizedTab } from "./VirtualizedTab";
import Stats from "stats.js";
import { useDebouncedValue } from "./useDebouncedValue";

function App() {
  const {
    fetchTabs,
    tabs,
    searchQuery,
    searchTabs,
    searchResults,
    semanticSearchTabs,
    semanticSearchResults,
    selectTab,
    closeTab,
  } = useTabStore();

  const listContainerRef = useRef<HTMLDivElement>(null);
  const virtualListInstanceRef = useRef<VirtualizedTabList | null>(null);

  const ITEM_HEIGHT = 44;
  const DEBOUNCE_DELAY = 150;

  const hasKeywordMatches = searchQuery && searchResults.length > 0;
  const hasSemanticMatches = searchQuery && semanticSearchResults.length > 0;

  const currentDisplayTabs = searchQuery
    ? hasKeywordMatches
      ? searchResults
      : hasSemanticMatches
        ? semanticSearchResults
        : []
    : tabs;

  const currentQueryForHighlight = hasKeywordMatches ? searchQuery : undefined;

  const debouncedDisplayTabs = useDebouncedValue(
    currentDisplayTabs,
    DEBOUNCE_DELAY,
  );
  const debouncedQueryForHighlight = useDebouncedValue(
    currentQueryForHighlight,
    DEBOUNCE_DELAY,
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      searchTabs(query);
      semanticSearchTabs(query);
    },
    [searchTabs, semanticSearchTabs],
  );

  useEffect(() => {
    console.log("useEffect");
    fetchTabs();

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

  useEffect(() => {
    if (listContainerRef.current) {
      virtualListInstanceRef.current = new VirtualizedTabList(
        listContainerRef.current,
        debouncedDisplayTabs,
        {
          itemHeight: ITEM_HEIGHT,
          onSelectTab: selectTab,
          onCloseTab: closeTab,
        },
        VirtualizedTab,
      );
    }
    return () => {
      virtualListInstanceRef.current?.destroy();
      virtualListInstanceRef.current = null;
    };
  }, [selectTab, closeTab]);

  useEffect(() => {
    if (virtualListInstanceRef.current) {
      virtualListInstanceRef.current.updateTabsData(
        debouncedDisplayTabs,
        debouncedQueryForHighlight,
      );
    }
  }, [debouncedDisplayTabs, debouncedQueryForHighlight]);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        if (virtualListInstanceRef.current) {
          virtualListInstanceRef.current.updateViewportHeight(newHeight);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex h-full w-full min-w-80 flex-col bg-neutral-900 text-white">
      <div className="sticky top-0 z-10 divide-y-1 divide-neutral-500 bg-inherit">
        <div className="p-4">
          <SearchBar inputValue={searchQuery} onChange={handleSearchChange} />
        </div>
        <div className="p-4 font-semibold text-neutral-400">
          {searchQuery
            ? hasKeywordMatches
              ? `${debouncedDisplayTabs.length} Keyword Matches`
              : hasSemanticMatches
                ? `${debouncedDisplayTabs.length} Semantic Matches`
                : "No Matches"
            : `${tabs.length} Open Tabs`}
        </div>
      </div>
      <div
        ref={listContainerRef}
        className="flex-grow overflow-y-auto"
        style={{ position: "relative" }}
      >
        {debouncedDisplayTabs.length === 0 && (
          <div className="px-4 py-8 text-center text-neutral-400">
            <InfoIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {searchQuery ? (
              <p>No tabs found matching "{searchQuery}"</p>
            ) : (
              <p>No tabs open. Try opening some tabs!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const setupFPS = () => {
  const stats = new Stats();
  stats.showPanel(0);
  stats.dom.style.top = "unset";
  stats.dom.style.left = "unset";
  stats.dom.style.bottom = "0";
  stats.dom.style.right = "0";

  for (const child of stats.dom.children) {
    // @ts-expect-error
    child.style.width = "160px";
    // @ts-expect-error
    child.style.height = "96px";
  }

  document.body.appendChild(stats.dom);
  const animate = () => {
    stats.update();
    window.requestAnimationFrame(animate);
  };
  window.requestAnimationFrame(animate);
};
setupFPS();

export default App;
