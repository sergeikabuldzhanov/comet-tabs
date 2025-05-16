# Comet Tab Manager - Experimental Chrome Extension

Comet Tab Manager is a Chrome extension built as an experiment to explore improvements over the native Chrome tab search and management UI. Main goals were to integrate semantic search and to achieve high performance, especially when dealing with a large number of open tabs.

## Core Features

- **Advanced Tab Search:**
  - **Keyword Search:** Quickly find tabs by title or URL using traditional keyword matching. Yields partial results for a responsive UI.
  - **Semantic Search:** Go beyond keywords and find tabs based on the meaning and context of their content. This is powered by an ML model (`TaylorAI/bge-micro-v2`) running locally in your browser using Transformers.js and ONNX Runtime (WebGPU). Also yields partial results as embeddings are compared.
- **High-Performance UI:**
  - **Virtualized List:** The tab list in the popup is rendered using a custom virtualized list implementation where I've tried to maximally reuse existing DOM nodes. This ensures that only the visible tab items are rendered in the DOM, providing a smooth scrolling experience even with hundreds or thousands of open tabs.
  - **Efficient Data Handling:** State management is built with Zustand. UI updates for search results are debounced, and both keyword & semantic search yield partial results to make the UI feel as fast as possible.
- **Content-Based Indexing:**
  - The extension tries to extract meaningful text content from open tabs (using Mozilla's Readability.js).
  - This content is then converted into vector embeddings by the local ML model.
  - Embeddings are stored locally in IndexedDB, allowing for fast similarity searches.

## Technical Highlights

- **Manifest V3:** Built following the latest Chrome extension platform standards.
- **TypeScript:** For robust and maintainable code.
- **React & Vite:** For building the popup UI, with Vite providing a fast development experience.
- **Tailwind CSS:** For utility-first styling.
- **Transformers.js (Xenova):** Enables running state-of-the-art ML models directly in the browser for embedding generation.
- **IndexedDB:** For local storage of tab content embeddings.
- **Custom Virtualization:** A minimal, non-React virtualized list component was implemented for rendering the tab list efficiently.

## Focus Areas & Learnings

This project served as an experiment with two main focuses:

1.  **Adding Semantic Search to Tab Management:** The core idea was to see how effectively a local ML model could enhance tab discovery by understanding the _content_ of web pages, not just their titles or URLs. This involved:

    - Setting up an embedding pipeline (content extraction -> model inference -> vector storage).
    - **Model Benchmarking & Selection:** Initial benchmarks were performed (see `src/background/modelBenchmark.ts`) to compare models and execution backends. `TaylorAI/bge-micro-v2` was chosen for its speed (approx. 2x faster than `Xenova/all-MiniLM-L6-v2` in tests) and compact size. WebGPU and GPU backends proved significantly faster (around 20ms per sentence) than WASM (around 100ms per sentence).
    - Implementing cosine similarity search against a query embedding.
    - Managing model loading, tokenization, and inference within the constraints of a browser extension.
    - **Yielding Partial Results:** Both keyword and semantic search implementations were designed to yield partial results to the UI as soon as they are found, improving perceived performance.

2.  **Performance with Many Tabs:** Native browser UIs can sometimes struggle with a very large number of open tabs. This project aimed to:
    - Implement a highly performant tab list using virtualization techniques to ensure smooth scrolling and interaction regardless of the number of items.
    - Optimize search algorithms and data updates to prevent UI freezes or jank (e.g., debouncing UI updates for search input).
    - Utilize main-thread scheduling to yield control during long-running JavaScript tasks (like initial keyword search over many tabs).

## How to Set Up and Run Locally

To run Comet Tab Manager on your own machine:

1.  **Clone the Repository:**

    ```bash
    git clone <repository-url>
    cd comet-tabs
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

3.  **Build the Extension:**

    ```bash
    npm run build
    ```

    This command will compile the TypeScript code, bundle the assets, and place the production-ready extension files into the `dist` directory.

4.  **Load into Chrome:**

    - Open Google Chrome and navigate to `chrome://extensions`.
    - Enable **Developer mode** using the toggle switch in the top-right corner.
    - Click the **"Load unpacked"** button.
    - In the file dialog, select the `dist` folder (created in the previous step) from your `comet-tabs` project directory.

5.  **Using the Extension:**
    - Once loaded, you should see the Comet Tab Manager icon in your Chrome toolbar.
    - Click the icon to open the popup.
    - The first time (and periodically as you open new tabs), the extension will index the content of your open tabs. The ML model will also download if it hasn't already (this is a one-time process, progress shown in the service worker console).
    - You can view the extension's console logs by going to `chrome://extensions`, finding "Comet Tab Manager", and clicking the link to inspect its service worker or popup page.

## Development

To run the extension in development mode with hot reloading:

```bash
npm run dev
```

Then, load the `dist` directory as an unpacked extension (as described above). Vite will watch for file changes and automatically rebuild and hot-reload.

## Future Ideas (Experimental)

- Automatic tab grouping based on semantic similarity.
- More sophisticated ranking for search results.
- Better flow for manually grouping tabs, i.e. just grouping all the results of a semantic search or adding them to an existing group in 1 click.
