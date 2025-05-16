// Background Service Worker for Comet Tab Manager
import { type FeatureExtractionPipeline } from "@huggingface/transformers";
import "./modelBenchmark";
import { ModelManager } from "./ModelManager";
import { normalizeUrl } from "./utils";
import {
  addOrUpdateEmbedding,
  getAllEmbeddings,
  clearAllEmbeddings,
  getEmbedding,
} from "./indexedDB";

// Semantic Search State
let currentActiveSearchID: string | null = null;
const SEMANTIC_SEARCH_BATCH_SIZE = 50;

const modelLoadingPromise: Promise<FeatureExtractionPipeline> =
  ModelManager.getInstance((progress) => {
    if (progress.status === "progress") {
      console.log("Model downloading..." + progress.progress.toFixed(2) + "%");
    }
  });

modelLoadingPromise
  .then(() => {
    console.log("Embedding model loaded successfully.");
  })
  .catch((error) => {
    console.error("Failed to load embedding model:", error);
  });

// Listen for installation event
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("Comet Tab Manager installed");

    // Trigger initial indexing after installation and model load
    // Note(sergei): chrome won't let you access unloaded or frozen tabs
    modelLoadingPromise.then(() => {
      console.log("Model ready, starting initial tab indexing...");
      indexAllTabs();
    });
  } else if (details.reason === "update") {
    console.log("Comet Tab Manager updated");
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "EXTRACTED_CONTENT") {
    const tabId = sender.tab?.id;
    const originalTabUrl = sender.tab?.url;
    const content = message.data?.content;
    const normalizedUrl = normalizeUrl(originalTabUrl);

    if (
      !tabId ||
      !normalizedUrl ||
      !normalizedUrl.startsWith("http") ||
      !content
    ) {
      console.warn(
        `EXTRACTED_CONTENT: Skipping due to invalid params. Tab ID: ${tabId}, Original URL: ${originalTabUrl}, Normalized: ${normalizedUrl}, HasContent: ${!!content}`,
      );
      sendResponse({
        success: false,
        error: "Cannot process content from tab due to invalid parameters.",
        params: { tabId, originalTabUrl, contentExists: !!content },
      });
      return false;
    }

    (async () => {
      console.log(
        `Background: Calling ModelManager.embed for URL ${normalizedUrl} (Tab ID: ${tabId})`,
      );
      const startTime = performance.now();
      try {
        await modelLoadingPromise;

        const embedding: number[] = await ModelManager.embed(content);
        await addOrUpdateEmbedding(normalizedUrl, embedding);
        const duration = performance.now() - startTime;
        console.log(
          `Background: Embedding stored for URL: ${normalizedUrl} (Tab ID: ${tabId}). Took ${duration.toFixed(2)} ms.`,
        );
        sendResponse({ success: true });
      } catch (error) {
        const duration = performance.now() - startTime;
        console.error(
          `Background: Error processing content for URL ${normalizedUrl} (Tab ID: ${tabId}). Took ${duration.toFixed(2)} ms:`,
          error,
        );
        sendResponse({
          success: false,
          error: `Failed to generate/store embedding for ${normalizedUrl}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    })();

    return true;
  }

  // Handle manual indexing trigger
  if (message.type === "TRIGGER_INDEXING") {
    console.log("Manual indexing triggered.");
    try {
      await modelLoadingPromise;
      console.log("Model ready, starting manual indexing...");
      indexAllTabs();
    } catch (error) {
      console.error("Model not loaded, cannot start manual indexing:", error);
    }
    return false;
  }

  if (message.type === "SEMANTIC_SEARCH_START") {
    const { query: newQueryText, searchId: newSearchId } = message;

    if (!newQueryText || !newSearchId) {
      console.error("SEMANTIC_SEARCH_START missing query or searchId");
      return false;
    }
    currentActiveSearchID = newSearchId;
    console.log(
      `Background: SEMANTIC_SEARCH_START received. Active ID set to: ${newSearchId}, Query: "${newQueryText}"`,
    );
    (async () => {
      if (currentActiveSearchID !== newSearchId) {
        console.log(
          `Search ID ${newSearchId} for query "${newQueryText}" was superseded before async processing began.`,
        );
        return;
      }
      try {
        if (currentActiveSearchID !== newSearchId) {
          console.log(
            `Search ID ${newSearchId} for query "${newQueryText}" was superseded before query embedding.`,
          );
          return;
        }

        const queryEmbedding = await ModelManager.embed(newQueryText);

        if (currentActiveSearchID !== newSearchId) {
          console.log(
            `Search ID ${newSearchId} for query "${newQueryText}" was superseded after query embedding generation.`,
          );
          return;
        }
        const tabEmbeddings = await getAllEmbeddings();

        if (currentActiveSearchID !== newSearchId) {
          console.log(
            `Search ID ${newSearchId} for query "${newQueryText}" was superseded after fetching tab embeddings.`,
          );
          return;
        }

        if (tabEmbeddings.length === 0) {
          console.log(
            `Background: No tab embeddings found in DB for search ID ${newSearchId}.`,
          );
          return;
        }

        console.log(
          `Background: Starting batch processing for ${tabEmbeddings.length} embeddings (Search ID: ${newSearchId})`,
        );
        processSemanticSearchBatch(newSearchId, newQueryText, queryEmbedding, [
          ...tabEmbeddings,
        ]);
      } catch (error) {
        console.error(
          `Background: Error during SEMANTIC_SEARCH_START setup for ID ${newSearchId}:`,
          error,
        );
        // Only send error and clear active ID if this search instance was the one that failed.
        if (currentActiveSearchID === newSearchId) {
          chrome.runtime
            .sendMessage({
              type: "SEMANTIC_SEARCH_ERROR",
              searchId: newSearchId,
              query: newQueryText,
              error: error instanceof Error ? error.message : String(error),
            })
            .catch((err) =>
              console.warn("Error sending SEMANTIC_SEARCH_ERROR:", err),
            );
          currentActiveSearchID = null;
        }
      }
    })();
    return true;
  }

  // Semantic Search Cancellation
  if (message.type === "CANCEL_SEMANTIC_SEARCH") {
    const { searchIdToCancel } = message;
    if (searchIdToCancel && searchIdToCancel === currentActiveSearchID) {
      console.log(
        `Background: Received CANCEL_SEMANTIC_SEARCH for active ID: ${searchIdToCancel}. Clearing active search ID.`,
      );
      currentActiveSearchID = null;
    } else {
      console.log(
        `Background: Received CANCEL_SEMANTIC_SEARCH for ID: ${searchIdToCancel}, but current active search ID is ${currentActiveSearchID || "none"}. No action.`,
      );
    }
    return false;
  }

  if (message.type === "ANALYZE_TABS") {
    // TODO(sergei): Find clusters of tabs with similar embeddings
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`Command received: ${command}`);
  if (command === "trigger-indexing") {
    console.log("Ctrl+I detected, triggering full tab indexing.");
    indexAllTabs();
  } else if (command === "clear-indexeddb") {
    console.log("Ctrl+Shift+Delete detected, clearing IndexedDB.");
    try {
      await clearAllEmbeddings();
      console.log("IndexedDB cleared successfully via command.");
    } catch (error) {
      console.error("Error clearing IndexedDB via command:", error);
    }
  }
});

// Listen for tab update events (for content extraction)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === 0 || changeInfo.status !== "complete") return;

  const normalizedUrl = normalizeUrl(tab.url);
  // Chrome blocks access to chrome://, about: and data: URLs
  if (!normalizedUrl || !normalizedUrl.startsWith("http")) return;

  try {
    const existingEmbedding = await getEmbedding(normalizedUrl);
    if (existingEmbedding) return;
  } catch (dbError) {
    console.error(
      `Background: Error checking for existing embedding for URL ${normalizedUrl}:`,
      dbError,
    );
  }

  // At this point this must be a new tab, so we can request content extraction
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "REQUEST_CONTENT_EXTRACTION",
    });
    console.log(
      `Background: Requested content extraction for updated tab ${tabId}`,
    );
  } catch (error) {
    console.warn(
      `Background: Could not send REQUEST_CONTENT_EXTRACTION to tab ${tabId}:`,
      error,
    );
  }
});

// Listen for tab removal events
chrome.tabs.onRemoved.addListener(async (tabId, _removeInfo) => {
  console.log("Tab removed event for Tab ID:", tabId);
  // TODO(sergei): set up periodic cleanup of embeddings for tabs that are no longer open?
});

// Try to embed all tabs that are currently open
async function indexAllTabs() {
  const tabs = await chrome.tabs.query({});
  console.log(`Found ${tabs.length} tabs to potentially index.`);

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const normalizedUrl = normalizeUrl(tab.url);
    if (
      !tab.id ||
      !normalizedUrl ||
      !normalizedUrl.startsWith("http") ||
      tab.status !== "complete"
    ) {
      console.log(`Tab params invalid:.`, {
        id: tab.id,
        url: normalizedUrl,
        status: tab.status,
      });
      continue;
    }

    const existingEmbedding = await getEmbedding(normalizedUrl);

    if (existingEmbedding) continue;

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "REQUEST_CONTENT_EXTRACTION",
      });
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"],
        });
        await chrome.tabs.sendMessage(tab.id, {
          type: "REQUEST_CONTENT_EXTRACTION",
        });
      } catch (injectionError) {
        console.error(
          `Failed to inject script or send message to tab ${tab.id} after injection attempt (URL: ${normalizedUrl}):`,
          injectionError,
        );
      }
    }
  }
}

// Export a timestamp for cache-busting in development
export const BUILD_TIMESTAMP = Date.now();

console.log("Comet Tab Manager background service worker initialized");

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    console.warn("Cosine similarity: Vector length mismatch or zero length.");
    return 0;
  }
  // For normalized vectors, dot product is cosine similarity.
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

function processSemanticSearchBatch(
  searchId: string,
  queryText: string,
  queryEmbeddingForThisRun: number[],
  pendingEmbeddingsForThisRun: { url: string; embedding: number[] }[],
) {
  if (currentActiveSearchID !== searchId) {
    console.log(
      `Semantic search ID ${searchId} for query "${queryText}" is no longer active. Cancelling batch processing.`,
    );
    return;
  }

  if (pendingEmbeddingsForThisRun.length === 0) {
    console.log(
      `Semantic search ID ${searchId} complete for query "${queryText}".`,
    );
    if (currentActiveSearchID === searchId) {
      chrome.runtime
        .sendMessage({
          type: "SEMANTIC_SEARCH_COMPLETE",
          searchId: searchId,
          query: queryText,
        })
        .catch((err) =>
          console.warn("Error sending SEMANTIC_SEARCH_COMPLETE:", err),
        );
      currentActiveSearchID = null;
    }
    return;
  }

  const batch = pendingEmbeddingsForThisRun.splice(
    0,
    SEMANTIC_SEARCH_BATCH_SIZE,
  );
  const batchMatches: { url: string; score: number }[] = [];
  const similarityThreshold = 0.5;

  for (const item of batch) {
    if (!item.embedding) {
      console.warn(
        `Item with URL ${item.url} missing embedding in search ID ${searchId}`,
      );
      continue;
    }
    const score = cosineSimilarity(queryEmbeddingForThisRun, item.embedding);
    if (score > similarityThreshold) {
      batchMatches.push({ url: item.url, score });
    }
  }

  if (batchMatches.length > 0) {
    chrome.runtime
      .sendMessage({
        type: "SEMANTIC_SEARCH_PARTIAL_RESULTS",
        searchId: searchId,
        query: queryText,
        results: batchMatches,
      })
      .catch((err) =>
        console.warn("Error sending SEMANTIC_SEARCH_PARTIAL_RESULTS:", err),
      );
  }

  // Schedule next batch
  setTimeout(
    () =>
      processSemanticSearchBatch(
        searchId,
        queryText,
        queryEmbeddingForThisRun,
        pendingEmbeddingsForThisRun,
      ),
    0,
  );
}
