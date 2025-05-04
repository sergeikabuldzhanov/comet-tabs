import { create } from "zustand";
import { Tab, TabGroup } from "./types";

interface TabState {
  tabs: Tab[];
  tabGroups: TabGroup[];
  searchQuery: string;
  searchResults: Tab[];
  loading: boolean;
  selectedTabId: number | null;
  suggestedGroups: Record<number, string[]>;

  // Actions
  fetchTabs: () => Promise<void>;
  searchTabs: (query: string) => void;
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
  analyzeTabContent: (tabId: number) => Promise<void>;
  suggestGroups: () => Promise<void>;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  tabGroups: [],
  searchQuery: "",
  searchResults: [],
  loading: false,
  selectedTabId: null,
  suggestedGroups: {},

  fetchTabs: async () => {
    set({ loading: true });

    try {
      // Fetch all tabs
      const tabs = await chrome.tabs.query({});

      // Fetch all tab groups
      const groups = await chrome.tabGroups.query({});

      // Combine tabs with their group information
      const enhancedTabs: Tab[] = tabs.map((tab) => {
        const group = groups.find((g) => g.id === tab.groupId);
        return {
          ...tab,
          groupName: group?.title,
          groupColor: group?.color,
        };
      });

      // Create tab groups with their tabs
      const tabGroups: TabGroup[] = groups.map((group) => ({
        ...group,
        tabs: enhancedTabs.filter((tab) => tab.groupId === group.id),
      }));

      // Update state
      set({
        tabs: enhancedTabs,
        tabGroups,
        loading: false,
        searchResults: get().searchQuery
          ? enhancedTabs.filter(
              (tab) =>
                tab.title
                  ?.toLowerCase()
                  .includes(get().searchQuery.toLowerCase()) ||
                tab.url
                  ?.toLowerCase()
                  .includes(get().searchQuery.toLowerCase()),
            )
          : [],
      });
    } catch (error) {
      console.error("Error fetching tabs:", error);
      set({ loading: false });
    }
  },

  searchTabs: (query: string) => {
    set({ searchQuery: query });

    if (!query) {
      set({ searchResults: [] });
      return;
    }

    const results = get().tabs.filter(
      (tab) =>
        tab.title?.toLowerCase().includes(query.toLowerCase()) ||
        tab.url?.toLowerCase().includes(query.toLowerCase()),
    );

    set({ searchResults: results });
  },

  selectTab: (tabId: number | null) => {
    set({ selectedTabId: tabId });

    if (tabId) {
      chrome.tabs.update(tabId, { active: true });
    }
  },

  groupTabs: async (tabIds: number[], groupName: string, color: string) => {
    try {
      // Create or update group
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
      // Get current tab state
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Toggle pinned state
      await chrome.tabs.update(tabId, { pinned: !tab.pinned });
      await get().fetchTabs();
    } catch (error) {
      console.error("Error toggling pin state:", error);
    }
  },

  toggleMuteTab: async (tabId: number) => {
    try {
      // Get current tab state
      const tab = get().tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Toggle muted state
      const muted = tab.mutedInfo?.muted ?? false;
      await chrome.tabs.update(tabId, { muted: !muted });
      await get().fetchTabs();
    } catch (error) {
      console.error("Error toggling mute state:", error);
    }
  },

  toggleGroupCollapse: async (groupId: number) => {
    try {
      // Get current group state from Chrome API
      const group = await chrome.tabGroups.get(groupId);
      if (!group) return;

      // Toggle collapsed state using the native Chrome API
      await chrome.tabGroups.update(groupId, { collapsed: !group.collapsed });

      // Update our local state by fetching the latest tab and group data
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

  analyzeTabContent: async (tabId: number) => {
    try {
      // This will be implemented with ML analysis later
      console.log(`Analyzing content for tab ${tabId}`);
      // Implementation will use transformers.js for content analysis
    } catch (error) {
      console.error("Error analyzing tab content:", error);
    }
  },

  suggestGroups: async () => {
    // This will be implemented with ML clustering later
    console.log("Suggesting groups based on content similarity");
    // Will use TensorFlow.js for clustering tabs by similarity
  },
}));
