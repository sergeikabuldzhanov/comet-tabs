export interface Tab extends chrome.tabs.Tab {
  groupName?: string;
  groupColor?: string;
  content?: string;
  keywords?: string[];
  embedding?: number[];
  similarTabs?: number[];
  category?: string;
  score?: number;
}

export interface TabGroup extends chrome.tabGroups.TabGroup {
  tabs: Tab[];
  titleComponent?: React.ReactNode;
}
