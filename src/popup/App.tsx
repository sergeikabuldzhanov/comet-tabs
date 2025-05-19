import { useEffect, useCallback, useRef } from "react";
import { useTabStore } from "./store";
import { InfoIcon } from "./components/Icons";
import SearchBar from "./components/SearchBar";
import { VirtualizedTabList } from "./VirtualizedTabList";
import { VirtualizedTab } from "./VirtualizedTab";
import Stats from "stats.js";
import { useDebouncedValue } from "./useDebouncedValue";

// Scroll-related variables and functions
let isAutoScrolling = false;
let autoScrollDirection = 1; // 1 for down, -1 for up
let animationFrameId: number | null = null;
// This selector targets the div that has the listContainerRef in App.tsx
const SCROLL_TARGET_ID = "auto-scroll-container";

export const ITEM_HEIGHT = 44;

function autoScrollStep() {
  const scrollContainer = document.querySelector<HTMLDivElement>(
    `#${SCROLL_TARGET_ID}`,
  );

  if (!scrollContainer) {
    console.error(
      "AutoScroller: Scroll container not found during step. Stopping auto-scroll.",
    );
    isAutoScrolling = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

  if (scrollHeight <= clientHeight) {
    autoScrollDirection *= -1; // Flip direction
    if (isAutoScrolling) {
      animationFrameId = requestAnimationFrame(autoScrollStep);
    }
    return;
  }

  if (autoScrollDirection === 1) {
    if (scrollTop >= scrollHeight - clientHeight - 1) {
      autoScrollDirection = -1;
    }
  } else {
    if (scrollTop <= 1) {
      autoScrollDirection = 1;
    }
  }

  const scrollSpeed = 150;
  scrollContainer.scrollBy(0, autoScrollDirection * scrollSpeed);

  if (isAutoScrolling) {
    // Continue if still active
    animationFrameId = requestAnimationFrame(autoScrollStep);
  }
}

function toggleAutoScroll() {
  isAutoScrolling = !isAutoScrolling;
  if (isAutoScrolling) {
    const scrollContainer = document.querySelector<HTMLDivElement>(
      `#${SCROLL_TARGET_ID}`,
    );
    if (!scrollContainer) {
      console.error(
        "AutoScroller: Scroll container not found. Cannot start auto-scroll.",
      );
      isAutoScrolling = false; // Revert state
      return;
    }
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(autoScrollStep);
    }
  } else {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
}

function setupAutoScrollListener() {
  document.body.addEventListener("keydown", (event) => {
    if (event.altKey && (event.key === "w" || event.key === "W")) {
      console.log("toggleAutoScroll");
      event.preventDefault();
      toggleAutoScroll();
    }
  });

  console.log("Auto-scroll hotkey (Alt+W) listener initialized.");
}

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

  const DEBOUNCE_DELAY = 100;

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

  const debouncedItemCount = useDebouncedValue(
    searchQuery
      ? hasKeywordMatches
        ? `${debouncedDisplayTabs.length} Keyword Matches`
        : hasSemanticMatches
          ? `${debouncedDisplayTabs.length} Semantic Matches`
          : "No Matches"
      : `${tabs.length} Open Tabs`,
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
    <div className="flex h-full max-h-[600px] w-full min-w-80 flex-col bg-neutral-900 text-white">
      <div className="sticky top-0 z-10 divide-y-1 divide-neutral-500 bg-inherit">
        <div className="p-4">
          <SearchBar inputValue={searchQuery} onChange={handleSearchChange} />
        </div>
        <div className="p-4 font-semibold text-neutral-400">
          {debouncedItemCount}
        </div>
      </div>
      <div
        ref={listContainerRef}
        className="flex-grow overflow-y-auto"
        style={{ position: "relative" }}
        id={SCROLL_TARGET_ID}
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
setupAutoScrollListener(); // Initialize the auto-scroll listener

export default App;
