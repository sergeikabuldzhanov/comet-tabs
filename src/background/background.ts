// Background Service Worker for Comet Tab Manager

// Listen for installation event
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("Comet Tab Manager installed");

    // Initialize storage with default settings
    await chrome.storage.local.set({
      settings: {
        autoGroupingEnabled: true,
        groupingThreshold: 0.7,
        searchHistory: [],
        colorScheme: "auto",
      },
    });

    // Set up periodic analysis alarm after installation
    setupPeriodicAnalysis();
  } else if (details.reason === "update") {
    console.log("Comet Tab Manager updated");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ANALYZE_TABS") {
    // We'll implement tab analysis and grouping here later
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_TAB_CONTENT") {
    // We'll implement content extraction here later
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Setup periodic tab analysis alarm
function setupPeriodicAnalysis() {
  // Safely check if alarms API is available
  if (chrome.alarms) {
    // Clear any existing alarms with this name
    chrome.alarms.clear("periodicTabAnalysis", () => {
      // Create a new alarm for periodic tab analysis
      chrome.alarms.create("periodicTabAnalysis", {
        periodInMinutes: 30, // Run every 30 minutes
      });
      console.log("Periodic tab analysis alarm set up");
    });

    // Listen for alarm events (for periodic tab analysis)
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "periodicTabAnalysis") {
        console.log("Running periodic tab analysis");
        // We'll implement periodic analysis here later
      }
    });
  } else {
    console.warn("Alarms API not available. Periodic tab analysis disabled.");
  }
}

// Listen for tab creation events
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log("Tab created:", tab.id);
  // This is where we'll add automatic grouping logic later
});

// Listen for tab update events (for content extraction)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  // Only analyze fully loaded tabs with complete status
  if (changeInfo.status === "complete") {
    console.log("Tab updated:", tabId);

    // We'll implement tab content extraction here later
    // This will be sent to the ML model for analysis
  }
});

// Export a timestamp for cache-busting in development
export const BUILD_TIMESTAMP = Date.now();

console.log("Comet Tab Manager background service worker initialized");
