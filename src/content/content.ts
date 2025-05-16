import { Readability } from "@mozilla/readability";

// Extract page content and metadata for analysis
function extractPageContent() {
  // Clone the document to avoid modifying the live page
  const documentClone = document.cloneNode(true) as Document;
  const reader = new Readability(documentClone);
  const article = reader.parse();

  // Basic metadata extraction (keep this as it might be useful)
  const metadata = {
    title: document.title || article?.title || "", // Use Readability title as fallback
    url: window.location.href,
    domain: window.location.hostname,
    // Add excerpt from Readability
    excerpt: article?.excerpt,
  };

  // Extracted main content text
  // Use article.textContent which contains the main readable content
  let mainContent = article?.textContent || ""; // Use empty string if parsing failed

  // Normalize whitespace: replace multiple whitespace chars with single space, then trim
  mainContent = mainContent.replace(/\s+/g, " ").trim();

  // Limit content length to avoid excessive data transfer/storage
  const maxContentLength = 10000;
  const truncatedContent = mainContent.substring(0, maxContentLength);

  // Send back to the extension
  chrome.runtime.sendMessage({
    type: "EXTRACTED_CONTENT",
    data: {
      metadata,
      content: truncatedContent,
      timestamp: Date.now(),
    },
  });
}

// Run content extraction when page is fully loaded
if (document.readyState === "complete") {
  setTimeout(extractPageContent, 500); // Timeout for dynamic content
} else {
  window.addEventListener("load", () => setTimeout(extractPageContent, 500));
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "REQUEST_CONTENT_EXTRACTION") {
    console.log("Content extraction requested by background script.");
    setTimeout(extractPageContent, 500);
    sendResponse({ success: true });
    return true;
  }

  return false;
});

console.log("Comet Tab Manager content script loaded.");
