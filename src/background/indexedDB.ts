// IndexedDB helper functions for Comet Tab Manager

const DB_NAME = "CometTabsDB";
const DB_VERSION = 2;
const OLD_STORE_NAME = "tabEmbeddings";
const STORE_NAME = "urlEmbeddings";

let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    console.log("Initializing IndexedDB...");
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(`IndexedDB error: ${request.error}`);
    };

    request.onsuccess = (event) => {
      console.log("IndexedDB initialized successfully.");
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log("IndexedDB upgrade needed.");
      const db = request.result;

      // Delete old store if it exists
      if (db.objectStoreNames.contains(OLD_STORE_NAME)) {
        console.log(`Deleting old object store: ${OLD_STORE_NAME}`);
        db.deleteObjectStore(OLD_STORE_NAME);
      }

      // Create new store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log(`Creating object store: ${STORE_NAME} with keyPath 'url'`);
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };
  });
  return dbPromise;
}

export async function addOrUpdateEmbedding(
  url: string,
  embedding: number[],
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    // Basic URL normalization: remove fragment
    const normalizedUrl = url.split("#")[0];
    const request = store.put({ url: normalizedUrl, embedding });

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error(
        "Error adding/updating embedding for URL:",
        normalizedUrl,
        request.error,
      );
      reject(request.error);
    };
  });
}

export async function getEmbedding(url: string): Promise<number[] | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const normalizedUrl = url.split("#")[0];
    const request = store.get(normalizedUrl);

    request.onsuccess = () => {
      resolve(request.result?.embedding);
    };
    request.onerror = () => {
      console.error(
        "Error getting embedding for URL:",
        normalizedUrl,
        request.error,
      );
      reject(request.error);
    };
  });
}

export async function deleteEmbedding(url: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const normalizedUrl = url.split("#")[0];
    const request = store.delete(normalizedUrl);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error(
        "Error deleting embedding for URL:",
        normalizedUrl,
        request.error,
      );
      reject(request.error);
    };
  });
}

export async function getAllEmbeddings(): Promise<
  { url: string; embedding: number[] }[]
> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      console.error("Error getting all embeddings:", request.error);
      reject(request.error);
    };
  });
}

export async function clearAllEmbeddings(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log(`All embeddings cleared from ${STORE_NAME}.`);
      resolve();
    };
    request.onerror = () => {
      console.error("Error clearing all embeddings:", request.error);
      reject(request.error);
    };
  });
}

initDB().catch((error) => {
  console.error("Failed to pre-initialize IndexedDB:", error);
});
