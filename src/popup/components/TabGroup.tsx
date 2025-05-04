import React from "react";
import { TabGroup as TabGroupType } from "../types";
import { useTabStore } from "../store";
import Tab from "./Tab";

interface TabGroupProps {
  group: TabGroupType;
  isUngroupedSection?: boolean;
  // Optional props for externally controlled collapse state
  isCollapsedOverride?: boolean;
  onToggleCollapseOverride?: () => void;
}

export const TabGroup: React.FC<TabGroupProps> = ({
  group,
  isUngroupedSection = false,
  isCollapsedOverride,
  onToggleCollapseOverride,
}) => {
  const { toggleGroupCollapse } = useTabStore();

  // Determine collapsed state: Use override if provided, otherwise use group's native state
  const isCollapsed =
    typeof isCollapsedOverride === "boolean"
      ? isCollapsedOverride
      : group.collapsed;

  // Get tabs in this group
  const { tabs } = group;

  // Handle toggle collapse click
  const handleToggleCollapse = (
    e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent,
  ) => {
    e.stopPropagation();
    // Use override handler if provided, otherwise use store action for native groups
    if (onToggleCollapseOverride) {
      onToggleCollapseOverride();
    } else {
      toggleGroupCollapse(group.id);
    }
  };
  return (
    <>
      <div
        tabIndex={0}
        className={`collapse-plus bg-${group.color}-500 border-base-300 collapse border ${isCollapsed ? "collapse-close" : "collapse-open"}`}
      >
        <input
          type="checkbox"
          checked={isCollapsed}
          onChange={handleToggleCollapse}
        />
        <div className="collapse-title glass flex items-start font-semibold">
          {isUngroupedSection
            ? "Ungrouped Tabs"
            : group.title || "Unnamed Group"}
          <div className="badge badge-xs badge-ghost ml-2">{tabs.length}</div>
        </div>
        <div className={`collapse-content p-0 ${isCollapsed ? "" : "!pb-0"}`}>
          {tabs.length > 0 ? (
            <div
              className={`divide-${group.color === "grey" ? "base" : group.color}-300 divide-y`}
            >
              {tabs.map((tab) => (
                <Tab key={tab.id} tab={tab} />
              ))}
            </div>
          ) : (
            <div className="text-base-content/50 p-3 text-center text-sm italic">
              No tabs in this group
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TabGroup;
