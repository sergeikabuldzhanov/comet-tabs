import { Tab } from "./types";
import { VirtualizedTab as VirtualizedTabInterface } from "./VirtualizedTabList";
import { getRelativeTimeString } from "./getRelativeTimeString";
import { ITEM_HEIGHT } from "./App";

const groupColorMap: Record<string, string> = {
  grey: "#D1D5DB", // Tailwind gray-300
  blue: "#A5B4FC", // Tailwind indigo-300
  red: "#FCA5A5", // Tailwind red-300
  yellow: "#FCD34D", // Tailwind amber-300
  green: "#86EFAC", // Tailwind green-300
  pink: "#F9A8D4", // Tailwind pink-300
  purple: "#C4B5FD", // Tailwind violet-300
  cyan: "#7DD3FC", // Tailwind sky-300
  orange: "#FDBA74", // Tailwind orange-300
};

interface VirtualizedTabOptions {
  query?: string;
  onSelectCb: (tabId: number) => void;
  onCloseCb: (tabId: number) => void;
}

export class VirtualizedTab implements VirtualizedTabInterface {
  public el: HTMLElement;
  private _tabData: Tab;
  private _query?: string;
  private _onSelectCb: (tabId: number) => void;
  private _onCloseCb: (tabId: number) => void;

  // DOM element references
  private faviconContainerEl!: HTMLElement;
  private faviconEl!: HTMLImageElement;
  private loadingSpinnerEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private urlEl!: HTMLElement;
  private relativeTimeEl!: HTMLElement;
  private groupIndicatorSvg?: SVGElement;
  private groupIndicatorCircle?: SVGCircleElement;
  private groupIndicatorTitleEl?: SVGTitleElement;
  private closeButtonEl!: HTMLButtonElement;

  constructor(initialTabData: Tab, options: VirtualizedTabOptions) {
    this._tabData = initialTabData;
    this._query = options.query;
    this._onSelectCb = options.onSelectCb;
    this._onCloseCb = options.onCloseCb;

    this.el = document.createElement("div");
    this._createDOM();
    this._attachEventListeners();
    this.update(this._tabData, this._query);
  }

  private _createDOM(): void {
    this.el.className = `group flex cursor-pointer items-center gap-3 px-3 py-1 hover:bg-neutral-700 absolute top-0 h-[${ITEM_HEIGHT}px] w-full`;
    this.el.style.willChange = "transform";

    // Favicon Container
    this.faviconContainerEl = document.createElement("div");
    this.faviconContainerEl.className =
      "relative h-9 w-9 flex-shrink-0 rounded-sm bg-neutral-600 p-2";

    // Loading Spinner
    this.loadingSpinnerEl = document.createElement("div");
    this.loadingSpinnerEl.className =
      "loading loading-spinner loading-xs absolute inset-0 m-auto";
    this.loadingSpinnerEl.style.display = "none";

    // Favicon Image
    this.faviconEl = document.createElement("img");
    this.faviconEl.alt = "";
    this.faviconEl.className = "h-full w-full object-contain";
    this.faviconEl.onerror = () => {
      this.faviconEl.style.display = "none";
    };

    this.faviconContainerEl.appendChild(this.loadingSpinnerEl);
    this.faviconContainerEl.appendChild(this.faviconEl);
    this.el.appendChild(this.faviconContainerEl);

    // Tab Info Container
    const tabInfoContainer = document.createElement("div");
    tabInfoContainer.className = "flex min-w-0 flex-grow flex-col";

    // Title Element
    this.titleEl = document.createElement("div");
    this.titleEl.className =
      "truncate text-[12px] font-semibold text-neutral-300";
    tabInfoContainer.appendChild(this.titleEl);

    // Second Row Container (Group Indicator, URL, Relative Time)
    const secondRowContainer = document.createElement("div");
    secondRowContainer.className = "flex items-center gap-x-[6px]";

    // Group Indicator (created on demand in update)

    // URL Element
    this.urlEl = document.createElement("div");
    this.urlEl.className = "truncate text-[11px] text-neutral-400";
    secondRowContainer.appendChild(this.urlEl);

    // Relative Time Element
    this.relativeTimeEl = document.createElement("div");
    this.relativeTimeEl.className =
      "text-[11px] whitespace-nowrap text-neutral-400";
    this.relativeTimeEl.style.minWidth = "70px";
    secondRowContainer.appendChild(this.relativeTimeEl);

    tabInfoContainer.appendChild(secondRowContainer);
    this.el.appendChild(tabInfoContainer);

    // Close Button
    this.closeButtonEl = document.createElement("button");
    this.closeButtonEl.type = "button";
    this.closeButtonEl.setAttribute("aria-label", "Close tab");
    this.closeButtonEl.className =
      "ml-auto hidden flex-shrink-0 rounded-md p-1 text-neutral-400 group-focus-within:inline-flex group-focus-within:items-center group-focus-within:justify-center group-focus-within:opacity-100 group-hover:inline-flex group-hover:items-center group-hover:justify-center group-hover:opacity-100 hover:bg-neutral-600 hover:text-neutral-200";

    const closeIconSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    closeIconSvg.setAttribute("fill", "none");
    closeIconSvg.setAttribute("viewBox", "0 0 24 24");
    closeIconSvg.setAttribute("stroke-width", "2");
    closeIconSvg.setAttribute("stroke", "currentColor");
    closeIconSvg.setAttribute("class", "h-4 w-4");
    const closeIconPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    closeIconPath.setAttribute("stroke-linecap", "round");
    closeIconPath.setAttribute("stroke-linejoin", "round");
    closeIconPath.setAttribute("d", "M6 18L18 6M6 6l12 12");
    closeIconSvg.appendChild(closeIconPath);
    this.closeButtonEl.appendChild(closeIconSvg);

    this.el.appendChild(this.closeButtonEl);
  }

  private _attachEventListeners(): void {
    this.el.addEventListener("click", () => {
      if (this._tabData && this._tabData.id !== undefined) {
        this._onSelectCb(this._tabData.id);
      }
    });

    this.closeButtonEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._tabData && this._tabData.id !== undefined) {
        this._onCloseCb(this._tabData.id);
      }
    });
  }

  private _highlightText(text: string, query?: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    if (!query || !text) {
      fragment.appendChild(document.createTextNode(text || ""));
      return fragment;
    }

    const lowerCaseText = text.toLowerCase();
    const lowerCaseQuery = query.toLowerCase();

    const matchIndex = lowerCaseText.indexOf(lowerCaseQuery);
    if (matchIndex === -1) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    // Add text before match
    if (matchIndex > 0)
      fragment.appendChild(
        document.createTextNode(text.substring(0, matchIndex)),
      );

    // Add highlighted match
    const matchText = text.substring(matchIndex, matchIndex + query.length);
    const span = document.createElement("span");
    span.className = "font-bold text-neutral-200";
    span.textContent = matchText;
    fragment.appendChild(span);

    // Add text after match
    const remainderIndex = matchIndex + query.length;
    if (remainderIndex < text.length)
      fragment.appendChild(
        document.createTextNode(text.substring(remainderIndex)),
      );

    return fragment;
  }

  public update(newTabData: Tab, newQuery?: string): void {
    this._tabData = newTabData;
    this._query = newQuery;

    if (this._tabData.active) {
      this.el.style.backgroundColor = "var(--color-neutral-700)";
    } else {
      this.el.style.backgroundColor = "";
    }

    // Update loading state
    this.loadingSpinnerEl.style.display =
      this._tabData.status === "loading" ? "block" : "none";
    this.faviconEl.style.display =
      this._tabData.status === "loading" ? "none" : "block";

    // Update Favicon
    if (this._tabData.favIconUrl && this._tabData.status !== "loading") {
      this.faviconEl.src = this._tabData.favIconUrl;
      this.faviconEl.style.display = "block";
    } else if (this._tabData.status !== "loading") {
      this.faviconEl.style.display = "none";
    }

    // Update Title
    this.titleEl.textContent = "";
    this.titleEl.appendChild(
      this._highlightText(this._tabData.title || "", this._query),
    );
    this.titleEl.title = this._tabData.title || "";

    // Update URL
    const cleanedUrl = this._tabData.url?.replace(/^https?:\/\//, "") ?? "";
    this.urlEl.textContent = "";
    this.urlEl.appendChild(this._highlightText(cleanedUrl, this._query));
    this.urlEl.title = this._tabData.url || "";

    // Update Relative Time
    const now = Date.now();
    const lastAccessed = new Date(this._tabData.lastAccessed ?? now);
    this.relativeTimeEl.textContent = getRelativeTimeString(lastAccessed);

    // Update Group Indicator
    const secondRowContainer = this.urlEl.parentElement!;
    if (this._tabData.groupColor) {
      if (!this.groupIndicatorSvg) {
        this.groupIndicatorSvg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        this.groupIndicatorSvg.setAttribute("width", "8");
        this.groupIndicatorSvg.setAttribute("height", "8");
        this.groupIndicatorSvg.setAttribute("viewBox", "0 0 8 8");
        this.groupIndicatorSvg.classList.add("flex-shrink-0");

        this.groupIndicatorCircle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        this.groupIndicatorCircle.setAttribute("cx", "4");
        this.groupIndicatorCircle.setAttribute("cy", "4");
        this.groupIndicatorCircle.setAttribute("r", "4");
        this.groupIndicatorSvg.appendChild(this.groupIndicatorCircle);

        // Create title element once and store it
        this.groupIndicatorTitleEl = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "title",
        ) as SVGTitleElement;
        this.groupIndicatorCircle.appendChild(this.groupIndicatorTitleEl);

        secondRowContainer.insertBefore(this.groupIndicatorSvg, this.urlEl);
      }
      const displayGroupColor =
        groupColorMap[this._tabData.groupColor] || this._tabData.groupColor;
      this.groupIndicatorSvg.style.filter = `drop-shadow(0 0 4px ${this._tabData.groupColor || "transparent"})`;
      this.groupIndicatorCircle!.setAttribute("fill", displayGroupColor);

      const groupTitle =
        this._tabData.groupName ?? `Group: ${this._tabData.groupColor}`;
      this.groupIndicatorSvg.setAttribute("aria-label", groupTitle);

      // Update textContent if it has changed
      if (
        this.groupIndicatorTitleEl &&
        this.groupIndicatorTitleEl.textContent !== groupTitle
      ) {
        this.groupIndicatorTitleEl.textContent = groupTitle;
      }

      this.groupIndicatorSvg.style.display = "block";
    } else if (this.groupIndicatorSvg) {
      this.groupIndicatorSvg.style.display = "none";
    }
  }

  public setOffset(offsetY: number): void {
    this.el.style.transform = `translateY(${offsetY}px)`;
  }

  public getId(): number {
    return this._tabData.id!;
  }

  public getElement(): HTMLElement {
    return this.el;
  }

  public destroy(): void {
    this.el.remove();
  }
}
