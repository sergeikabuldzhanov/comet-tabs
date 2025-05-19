import { Tab } from "./types";

export interface VirtualizedTab {
  getElement(): HTMLElement;
  update(tabData: Tab, query?: string): void;
  setOffset(offsetY: number): void;
  destroy(): void;
  getId(): number;
}

export interface VirtualizedTabConstructor {
  new (
    initialTabData: Tab,
    options: {
      query?: string;
      onSelectCb: (tabId: number) => void;
      onCloseCb: (tabId: number) => void;
    },
  ): VirtualizedTab;
}

interface VirtualizedTabListOptions {
  itemHeight: number;
  onSelectTab: (tabId: number) => void;
  onCloseTab: (tabId: number) => void;
  renderBuffer?: number; // Number of items to render above/below the visible viewport.
}

export class VirtualizedTabList {
  private container: HTMLElement;
  private tabsData: Tab[];
  private itemHeight: number;
  private onSelectTabCb: (tabId: number) => void;
  private onCloseTabCb: (tabId: number) => void;
  private ItemtabClass: VirtualizedTabConstructor;

  private viewportHeight: number;
  private scrollTop: number;
  private sizerEl: HTMLElement; // Used to maintain the correct scrollbar size.

  private renderedTabs: Record<number, VirtualizedTab>;

  private visibleStartIndex: number; // Index of the first tab to render.
  private visibleEndIndex: number; // Index of the tab after the last one to render.
  private renderBuffer: number;

  private currentQuery?: string;

  constructor(
    container: HTMLElement,
    initialTabsData: Tab[],
    options: VirtualizedTabListOptions,
    ItemtabClass: VirtualizedTabConstructor,
  ) {
    this.container = container;
    this.tabsData = initialTabsData;
    this.itemHeight = options.itemHeight;
    this.onSelectTabCb = options.onSelectTab;
    this.onCloseTabCb = options.onCloseTab;
    this.renderBuffer = options.renderBuffer ?? 3; // Default buffer of 3 items.
    this.ItemtabClass = ItemtabClass;

    this.viewportHeight = this.container.clientHeight;
    this.scrollTop = this.container.scrollTop;

    this.sizerEl = document.createElement("div");
    this.sizerEl.style.position = "relative";
    this.sizerEl.style.width = "1px"; // Does not affect layout width.
    this.sizerEl.style.opacity = "0"; // Invisible.
    this.container.appendChild(this.sizerEl);

    this.renderedTabs = {};

    this.visibleStartIndex = 0;
    this.visibleEndIndex = 0;

    this._updateSizerHeight();
    this._calculateVisibleRange();
    this.renderVisibleItems();

    this.container.addEventListener("scroll", this._handleScroll);
  }

  private _handleScroll = (): void => {
    this.scrollTop = this.container.scrollTop;
    this._calculateVisibleRange();
    this.renderVisibleItems();
  };

  private _calculateVisibleRange(): void {
    const newFirstVisibleIndex = Math.floor(this.scrollTop / this.itemHeight);
    const newVisibleItemCount = Math.ceil(
      this.viewportHeight / this.itemHeight,
    );

    this.visibleStartIndex = Math.max(
      0,
      newFirstVisibleIndex - this.renderBuffer,
    );
    this.visibleEndIndex = Math.min(
      this.tabsData.length,
      newFirstVisibleIndex + newVisibleItemCount + this.renderBuffer,
    );
  }

  private _updateSizerHeight(): void {
    const totalHeight = this.tabsData.length * this.itemHeight;
    this.sizerEl.style.height = `${totalHeight}px`;
  }

  public renderVisibleItems(): void {
    const renderTabs: Record<number, true> = {};
    const tabs = this.tabsData;

    for (let i = this.visibleStartIndex; i < this.visibleEndIndex; i++) {
      const tab = this.tabsData[i];
      renderTabs[tab.id!] = true;
    }

    // Identify tabs to remove/recycle
    const tabsToRecycle: VirtualizedTab[] = [];
    for (const tabId in this.renderedTabs) {
      if (tabId in renderTabs) continue;
      const tabComponent = this.renderedTabs[tabId];
      tabsToRecycle.push(tabComponent);
    }

    for (let i = this.visibleStartIndex; i < this.visibleEndIndex; i++) {
      const tab = tabs[i];

      const existingTab = this.renderedTabs[tab.id!];
      const offset = i * this.itemHeight;
      if (existingTab) {
        existingTab.setOffset(offset);
        continue;
      }
      const reuseTab = tabsToRecycle.pop();
      if (reuseTab) {
        delete this.renderedTabs[reuseTab.getId()];
        reuseTab.setOffset(offset);
        this.renderedTabs[tab.id!] = reuseTab;
        reuseTab.update(tab, this.currentQuery);
        continue;
      }
      const newTab = new this.ItemtabClass(tabs[i], {
        query: this.currentQuery,
        onSelectCb: this.onSelectTabCb,
        onCloseCb: this.onCloseTabCb,
      });
      newTab.setOffset(offset);
      this.renderedTabs[tab.id!] = newTab;
      this.container.appendChild(newTab.getElement());
    }
    for (const tab of tabsToRecycle) {
      if (tab.getElement().parentNode === this.container) {
        this.container.removeChild(tab.getElement());
      }
      tab.destroy();
      delete this.renderedTabs[tab.getId()];
    }
  }

  public updateTabsData(newTabsData: Tab[], newQuery?: string): void {
    this.tabsData = newTabsData;
    this.currentQuery = newQuery;

    this._updateSizerHeight();

    const maxScrollTop = Math.max(
      0,
      this.tabsData.length * this.itemHeight - this.viewportHeight,
    );
    if (this.container.scrollTop > maxScrollTop) {
      this.container.scrollTop = maxScrollTop;
    }
    this.scrollTop = this.container.scrollTop;

    this._calculateVisibleRange();
    this.renderVisibleItems();
  }

  public updateViewportHeight(newHeight: number): void {
    if (this.viewportHeight === newHeight || newHeight <= 0) return; // Avoid unnecessary updates or invalid heights
    this.viewportHeight = newHeight;
    this._calculateVisibleRange();
    this.renderVisibleItems();
  }

  public destroy(): void {
    this.container.removeEventListener("scroll", this._handleScroll);

    for (const tabId in this.renderedTabs) {
      const tab = this.renderedTabs[tabId];
      if (tab.getElement().parentNode === this.container) {
        this.container.removeChild(tab.getElement());
      }
      tab.destroy();
    }

    if (this.sizerEl.parentNode === this.container) {
      this.container.removeChild(this.sizerEl);
    }
  }
}
