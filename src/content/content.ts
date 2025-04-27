// Content script for Comet Tab Manager
// This script runs in the context of web pages

// Extract page content and metadata for analysis
function extractPageContent() {
  // Basic metadata extraction
  const metadata = {
    title: document.title,
    url: window.location.href,
    domain: window.location.hostname,
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent).filter(Boolean),
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    metaKeywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
  };

  // Extract main content (simplified version)
  const bodyText = document.body.innerText.substring(0, 10000); // Limit to 10K chars
  
  // Send back to the extension
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT',
    data: {
      metadata,
      content: bodyText,
      timestamp: Date.now()
    }
  });
}

// Run content extraction when page is fully loaded
if (document.readyState === 'complete') {
  extractPageContent();
} else {
  window.addEventListener('load', extractPageContent);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    extractPageContent();
    sendResponse({ success: true });
    return true;
  }
  return false;
});

console.log('Comet Tab Manager content script loaded'); 