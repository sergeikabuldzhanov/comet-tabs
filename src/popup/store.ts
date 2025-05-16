import { create } from "zustand";
import { Tab, TabGroup } from "./types";
import { isTimeToYield, yieldControl } from "main-thread-scheduling";
import { normalizeUrl } from "../background/utils";

// Semantic Search Result with score
type TabWithScore = Tab & { score: number };

interface TabState {
  tabs: Tab[];
  tabGroups: TabGroup[];
  searchQuery: string;
  searchResults: Tab[];
  semanticSearchResults: TabWithScore[];
  selectedTabId: number | null;
  suggestedGroups: Record<number, string[]>;
  isIndexing: boolean;
  isSemanticSearching: boolean;
  currentSemanticSearchId: string | null;
  gotPartialResults: boolean;

  // Actions
  fetchTabs: () => Promise<void>;
  searchTabs: (query: string) => Promise<void>;
  semanticSearchTabs: (query: string) => Promise<void>;
  selectTab: (tabId: number | null) => void;
  groupTabs: (
    tabIds: number[],
    groupName: string,
    color: string,
  ) => Promise<void>;
  ungroupTab: (tabId: number) => Promise<void>;
  closeTab: (tabId: number) => Promise<void>;
  togglePinTab: (tabId: number) => Promise<void>;
  toggleMuteTab: (tabId: number) => Promise<void>;
  toggleGroupCollapse: (groupId: number) => Promise<void>;
  renameTabGroup: (groupId: number, newTitle: string) => Promise<void>;
  suggestGroups: () => Promise<void>;
  triggerFullIndexing: () => Promise<void>;
}

// Helper to generate unique search IDs
const generateSearchId = (query: string) => `${Date.now()}_${query}`;

export const useTabStore = create<TabState>((set, get) => {
  const handleBackgroundMessages = (message: any) => {
    const messageType = message.type;
    const messageSearchId = message.searchId;
    const currentSearchId = get().currentSemanticSearchId;
    const messageRelatesToCurrentSearch =
      messageSearchId && messageSearchId === currentSearchId;
    if (!messageRelatesToCurrentSearch) {
      console.log(
        "Popup store: Received stale/unmatched SEMANTIC_SEARCH_PARTIAL_RESULTS",
        message,
      );
      return;
    }
    if (messageType === "SEMANTIC_SEARCH_PARTIAL_RESULTS") {
      const allTabs = get().tabs;
      const newFoundTabs = message.results
        .map((r: { url: string; score: number }) => {
          const tab = allTabs.find((t) => normalizeUrl(t.url) === r.url);
          return tab ? { ...tab, score: r.score } : null;
        })
        .filter((t?: TabWithScore): t is TabWithScore => Boolean(t));

      if (!get().gotPartialResults) {
        // This is the first batch of results for the current search
        const sortedResults = [...newFoundTabs].sort(
          (a, b) => b.score - a.score,
        );
        set({
          semanticSearchResults: sortedResults,
          gotPartialResults: true,
        });
      } else {
        // Subsequent batches, append and re-sort
        const currentResults = get().semanticSearchResults;
        const updatedResults = [...currentResults, ...newFoundTabs];
        updatedResults.sort((a, b) => b.score - a.score);
        set({
          semanticSearchResults: updatedResults,
        });
      }
    } else if (messageType === "SEMANTIC_SEARCH_COMPLETE") {
      const newStateUpdate: Partial<TabState> = {
        isSemanticSearching: false,
        currentSemanticSearchId: null,
        gotPartialResults: false,
      };

      if (!get().gotPartialResults) {
        newStateUpdate.semanticSearchResults = [];
      }

      set(newStateUpdate);
    } else if (messageType === "SEMANTIC_SEARCH_ERROR") {
      console.error(
        "Popup store: Received SEMANTIC_SEARCH_ERROR",
        message.error,
      );
      set({
        isSemanticSearching: false,
        semanticSearchResults: [],
        currentSemanticSearchId: null,
      });
    }
  };

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(handleBackgroundMessages);
  } else {
    console.warn(
      "chrome.runtime.onMessage not available. Semantic search updates from background may not work.",
    );
  }

  // remove tabs that are closed from the store & search results
  chrome.tabs.onRemoved.addListener((tabId) => {
    set((state) => ({
      tabs: state.tabs.filter((tab) => tab.id !== tabId),
      searchResults: state.searchResults.filter((tab) => tab.id !== tabId),
      semanticSearchResults: state.semanticSearchResults.filter(
        (tab) => tab.id !== tabId,
      ),
    }));
  });

  return {
    tabs: [],
    tabGroups: [],
    searchQuery: "",
    searchResults: [],
    semanticSearchResults: [],
    loading: false,
    selectedTabId: null,
    suggestedGroups: {},
    isIndexing: false,
    isSemanticSearching: false,
    currentSemanticSearchId: null,
    gotPartialResults: false,

    fetchTabs: async () => {
      try {
        const tabs = await chrome.tabs.query({});
        tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));

        const groups = await chrome.tabGroups.query({});

        // Combine tabs with their group information
        const enhancedTabs: Tab[] = tabs.map((tab) => {
          const group = groups.find((g) => g.id === tab.groupId);
          return Object.assign(tab, {
            groupName: group?.title,
            groupColor: group?.color,
          });
        });

        // Create tab groups with their tabs
        const tabGroups: TabGroup[] = groups.map((group) =>
          Object.assign(group, {
            tabs: enhancedTabs.filter((tab) => tab.groupId === group.id),
          }),
        );

        // Update state
        set({
          tabs: enhancedTabs,
          tabGroups,
        });
      } catch (error) {
        console.error("Error fetching tabs:", error);
      }
    },

    searchTabs: async (query: string) => {
      // Store the query this specific search operation was initiated with
      const initialQuery = query;
      set({ searchQuery: initialQuery }); // Update the global searchQuery immediately

      if (!initialQuery.trim()) {
        set({ searchResults: [] });
        return;
      }

      const lowerCaseQuery = initialQuery.toLowerCase();
      const allTabs = get().tabs;
      const accumulatedResults: Tab[] = [];
      const ROW_CHUNK_SIZE = 50;
      const numChunks = Math.ceil(allTabs.length / ROW_CHUNK_SIZE);
      const minEarlyResults = 15;
      let setEarlyResults = false;
      for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        if (get().searchQuery !== initialQuery) {
          return;
        }
        const timeToYield = isTimeToYield("interactive");
        if (timeToYield) {
          await yieldControl();
          if (get().searchQuery !== initialQuery) {
            return;
          }
        }

        const startIndex = chunkIndex * ROW_CHUNK_SIZE;
        const endIndex = Math.min(startIndex + ROW_CHUNK_SIZE, allTabs.length);

        for (let i = startIndex; i < endIndex; i++) {
          const tab = allTabs[i];
          if (
            tab.title &&
            tab.title.toLowerCase().indexOf(lowerCaseQuery) !== -1
          ) {
            accumulatedResults.push(tab);
            continue;
          }
          if (tab.url && tab.url.toLowerCase().indexOf(lowerCaseQuery) !== -1) {
            accumulatedResults.push(tab);
            continue;
          }
        }
        if (accumulatedResults.length >= minEarlyResults && !setEarlyResults) {
          set({ searchResults: [...accumulatedResults] });
          setEarlyResults = true;
        }
      }
      set({ searchResults: [...accumulatedResults] });
    },

    semanticSearchTabs: async (query: string) => {
      set({ searchQuery: query });

      const oldSearchId = get().currentSemanticSearchId;

      // If query is less than 3 chars, don't perform semantic search.
      // Cancel any ongoing semantic search and clear results.
      if (query.trim().length < 3) {
        if (oldSearchId) {
          chrome.runtime
            .sendMessage({
              type: "CANCEL_SEMANTIC_SEARCH",
              searchIdToCancel: oldSearchId,
            })
            .catch((err) =>
              console.warn(
                "Error sending CANCEL_SEMANTIC_SEARCH for short query:",
                err,
              ),
            );
        }
        set({
          semanticSearchResults: [],
          isSemanticSearching: false,
          currentSemanticSearchId: null,
          gotPartialResults: false,
        });
        return;
      }

      // Proceed with semantic search for queries >= 3 chars.
      const newSearchId = generateSearchId(query);

      if (oldSearchId && oldSearchId !== newSearchId) {
        chrome.runtime
          .sendMessage({
            type: "CANCEL_SEMANTIC_SEARCH",
            searchIdToCancel: oldSearchId,
          })
          .catch((err) =>
            console.warn("Error sending CANCEL_SEMANTIC_SEARCH:", err),
          );
      }

      set({
        currentSemanticSearchId: newSearchId,
        isSemanticSearching: true,
        gotPartialResults: false,
      });

      chrome.runtime
        .sendMessage({
          type: "SEMANTIC_SEARCH_START",
          query: query,
          searchId: newSearchId,
        })
        .catch((error) => {
          console.error(
            "Popup store: Error sending SEMANTIC_SEARCH_START message:",
            error,
          );
          set({
            isSemanticSearching: false,
            currentSemanticSearchId: null, // Clear search ID as it failed to start
            semanticSearchResults: [],
          });
        });
    },

    selectTab: (tabId: number | null) => {
      set({ selectedTabId: tabId });

      if (tabId) {
        chrome.tabs.update(tabId, { active: true });
      }
    },

    groupTabs: async (tabIds: number[], groupName: string, color: string) => {
      try {
        const existingGroups = await chrome.tabGroups.query({
          title: groupName,
        });

        let groupId: number;

        if (existingGroups.length > 0) {
          groupId = existingGroups[0].id;
          await chrome.tabs.group({ tabIds, groupId });
        } else {
          groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: groupName,
            color: color as chrome.tabGroups.ColorEnum,
          });
        }

        // Refresh tabs
        await get().fetchTabs();
      } catch (error) {
        console.error("Error grouping tabs:", error);
      }
    },

    ungroupTab: async (tabId: number) => {
      try {
        await chrome.tabs.ungroup(tabId);
        await get().fetchTabs();
      } catch (error) {
        console.error("Error ungrouping tab:", error);
      }
    },

    closeTab: async (tabId: number) => {
      try {
        await chrome.tabs.remove(tabId);
        await get().fetchTabs();
      } catch (error) {
        console.error("Error closing tab:", error);
      }
    },

    togglePinTab: async (tabId: number) => {
      try {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (!tab) return;

        await chrome.tabs.update(tabId, { pinned: !tab.pinned });
        await get().fetchTabs();
      } catch (error) {
        console.error("Error toggling pin state:", error);
      }
    },

    toggleMuteTab: async (tabId: number) => {
      try {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (!tab) return;

        const muted = tab.mutedInfo?.muted ?? false;
        await chrome.tabs.update(tabId, { muted: !muted });
        await get().fetchTabs();
      } catch (error) {
        console.error("Error toggling mute state:", error);
      }
    },

    toggleGroupCollapse: async (groupId: number) => {
      try {
        const group = await chrome.tabGroups.get(groupId);
        if (!group) return;

        await chrome.tabGroups.update(groupId, { collapsed: !group.collapsed });

        await get().fetchTabs();
      } catch (error) {
        console.error("Error toggling group collapse state:", error);
      }
    },

    renameTabGroup: async (groupId: number, newTitle: string) => {
      try {
        await chrome.tabGroups.update(groupId, { title: newTitle });
        await get().fetchTabs();
      } catch (error) {
        console.error(`Error renaming tab group ${groupId}:`, error);
      }
    },

    suggestGroups: async () => {
      // TODO
      console.log("Suggesting groups based on content similarity");
    },

    triggerFullIndexing: async () => {
      console.log("Triggering full tab indexing...");
      set({ isIndexing: true });
      try {
        await chrome.runtime.sendMessage({ type: "TRIGGER_INDEXING" });
        console.log("Indexing message sent to background.");
      } catch (error) {
        console.error("Error sending indexing message:", error);
      } finally {
        set({ isIndexing: false });
      }
    },
  };
});
