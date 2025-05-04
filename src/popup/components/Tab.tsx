import React from "react";
import { Tab as TabType } from "../types";
import { useTabStore } from "../store";
import { PinIcon, AudioIcon, MutedIcon, CloseIcon } from "./Icons";

interface TabProps {
  tab: TabType;
}

export const Tab: React.FC<TabProps> = ({ tab }) => {
  const { closeTab, togglePinTab, toggleMuteTab, selectTab } = useTabStore();

  // Handle click on the tab
  const handleTabClick = (e: React.MouseEvent) => {
    // Prevent triggering when clicking on action buttons
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    selectTab(tab.id!);
  };

  // Handle close button click
  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      closeTab(tab.id);
    }
  };

  // Handle pin button click
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      togglePinTab(tab.id);
    }
  };

  // Handle mute button click
  const handleMuteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.id) {
      toggleMuteTab(tab.id);
    }
  };

  // Determine if tab is muted
  const isMuted = tab.mutedInfo?.muted ?? false;
  // Determine loading state
  const isLoading = tab.status === "loading";

  return (
    <div
      onClick={handleTabClick}
      className={`grid cursor-pointer grid-rows-[auto,auto] gap-y-1 p-2 transition-all duration-200 ease-in-out ${tab.active ? "border-l-primary border-l-4" : "border-l-4 border-l-transparent"} hover:bg-base-200/50`}
    >
      {/* Row 1: Grid for favicon and actions */}
      <div className="flex w-full items-center justify-between gap-2">
        {/* Favicon / Loading Indicator (Column 1) */}
        <div className="relative h-4 w-4 flex-shrink-0">
          {isLoading ? (
            <div className="loading loading-spinner loading-xs absolute inset-0 m-auto"></div>
          ) : tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className="h-full w-full rounded-sm object-contain"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="bg-base-300 h-full w-full rounded-sm"></div>
          )}
        </div>

        {/* Action Buttons (Column 2) - Use flexbox for internal layout */}
        <div className="flex items-center justify-end gap-1">
          {/* Pin Button - Acts as indicator */}
          <button
            onClick={handlePinClick}
            className="btn btn-ghost btn-xs btn-square"
            title={tab.pinned ? "Unpin tab" : "Pin tab"}
          >
            <PinIcon
              className={`h-4 w-4 ${tab.pinned ? "fill-primary" : "fill-base-content/50"}`}
            />
          </button>

          {/* Mute/Unmute Button - Acts as indicator, only show for audible or muted tabs */}
          {(tab.audible || isMuted) && (
            <button
              onClick={handleMuteClick}
              className="btn btn-ghost btn-xs btn-square"
              title={isMuted ? "Unmute tab" : "Mute tab"}
            >
              {/* Use MutedIcon or AudioIcon based on state */}
              {isMuted ? (
                <MutedIcon className="fill-base-content/70 h-4 w-4" />
              ) : (
                <AudioIcon className="fill-primary h-4 w-4 animate-pulse" />
              )}
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={handleCloseClick}
            className="btn btn-ghost btn-xs btn-square hover:bg-error hover:text-white"
            title="Close tab"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Row 2: Tab Title (spans all columns) */}
      <div
        className="col-span-full w-full truncate px-1 text-sm"
        title={tab.title}
      >
        {tab.title}
      </div>
    </div>
  );
};

export default Tab;
