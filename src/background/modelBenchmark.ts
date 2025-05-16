import { pipeline, AutoTokenizer } from "@huggingface/transformers";

// --- Backend Benchmarking Utility ---
async function benchmarkBackends() {
  const models = [
    // "Xenova/all-MiniLM-L6-v2",
    "TaylorAI/bge-micro-v2", // 2 times as fast as all-MiniLM-L6-v2
  ];

  const backends = [
    // "wasm", // too slow, ~100ms per sentence
    // "webnn", // poor support, need to go lower level than extension context allows
    "gpu", // ~20ms per sentence
    "webgpu", // ~20ms per sentence
  ];

  // Looks like a J curve with minima at 2-5
  const batchSizesToTest = [
    1, // N per sentence, as base
    2, // ~0.85N per sentence
    3, // ~0.7N
    4, // ~0.7N
    5, // ~0.75N
    7, // ~0.85N
    10, // 1.3N
  ];

  let allTestSentences: string[] = [];

  const MAX_TOKENS = 512; // Define max tokens for truncation

  const response = await fetch(chrome.runtime.getURL("test_text.json"));
  if (!response.ok)
    throw new Error(`Failed to fetch test_text.json: ${response.statusText}`);
  allTestSentences = await response.json();

  if (allTestSentences.length === 0) {
    console.error("[BENCHMARK] No test sentences. Aborting.");
    return;
  }

  for (const model of models) {
    console.log(`\\n[BENCHMARK] ===== Model: ${model} =====`);
    const modelResultsTable: any[] = [];

    let tokenizer;
    try {
      console.log(`[BENCHMARK] Loading tokenizer for ${model}...`);
      tokenizer = await AutoTokenizer.from_pretrained(model);
      console.log(`[BENCHMARK] Tokenizer for ${model} loaded.`);
    } catch (tokenizerError) {
      console.error(
        `[BENCHMARK] Failed to load tokenizer for ${model}:`,
        tokenizerError,
      );
      // Add a result to the table indicating tokenizer failure for this model
      modelResultsTable.push({
        Model: model,
        Backend: "N/A",
        BatchSize: "N/A",
        AvgBatchTimeMs: "N/A",
        Error: `Tokenizer load failed: ${tokenizerError}`,
      });
      console.table(modelResultsTable); // Show partial results for this model
      continue; // Skip to the next model
    }

    for (const backend of backends) {
      console.log(`\\n  [BENCHMARK] --- Backend: ${backend} ---`);
      let extractor;
      let initMs = -1;
      try {
        const startInit = performance.now();
        // @ts-ignore
        extractor = await pipeline(task, model, { device: backend as any });
        initMs = performance.now() - startInit;
        console.log(`    Initialized in ${initMs.toFixed(2)} ms`);
      } catch (initError) {
        console.error(`    Failed to initialize:`, initError);
        modelResultsTable.push({
          Model: model,
          Backend: backend,
          BatchSize: "N/A",
          AvgBatchTimeMs: "N/A",
          Error: `Init failed: ${initError}`,
        });
        continue; // Skip to next backend if init fails
      }

      for (const currentBatchSize of batchSizesToTest) {
        const batchEmbedTimes: number[] = [];
        let totalProcessingTimeForBatchSize = 0;
        let batchesProcessed = 0;
        let errorInBatch = null;

        console.log(`    Testing Batch Size: ${currentBatchSize}`);
        try {
          // Process the allTestSentences in chunks of currentBatchSize
          for (let i = 0; i < allTestSentences.length; i += currentBatchSize) {
            const rawBatch = allTestSentences.slice(i, i + currentBatchSize);
            if (rawBatch.length === 0) continue;

            const processedBatch = [];
            const startEmbedBatch = performance.now();
            for (const text of rawBatch) {
              let inputText = text;
              const tokensCount = tokenizer.encode(text).length;

              if (tokensCount > MAX_TOKENS) {
                const trimRation = (MAX_TOKENS / tokensCount) * 0.9;
                const maxChars = Math.floor(MAX_TOKENS * trimRation);
                console.warn(
                  `      [BENCHMARK] Truncating sentence for model ${model}. Target: ${MAX_TOKENS}. Sentence: "${text.substring(0, 70)}..."`,
                );
                inputText = text.substring(0, maxChars);
              }
              processedBatch.push(inputText);
            }

            try {
              await extractor(processedBatch, {
                pooling: "mean",
                normalize: true,
              });
            } catch (e) {
              console.error(
                `      [BENCHMARK ERROR IN EXTRACTOR] Batch that caused error (model: ${model}, backend: ${backend}, batchSize: ${currentBatchSize}):`,
                processedBatch,
              );
              throw e;
            }
            const endEmbedBatch = performance.now();
            const batchMs = endEmbedBatch - startEmbedBatch;
            batchEmbedTimes.push(batchMs);
            totalProcessingTimeForBatchSize += batchMs;
            batchesProcessed++;
          }

          if (batchesProcessed > 0) {
            const avgBatchTime =
              totalProcessingTimeForBatchSize / batchesProcessed;
            modelResultsTable.push({
              Backend: backend,
              BatchSize: currentBatchSize,
              InitMs: initMs.toFixed(2),
              NumBatchesRun: batchesProcessed,
              AvgBatchTimeMs: avgBatchTime.toFixed(2),
              AvgTimePerItemMs: (avgBatchTime / currentBatchSize).toFixed(2),
              TotalEmbedTimeMs: totalProcessingTimeForBatchSize.toFixed(2),
            });
          } else if (!errorInBatch) {
            modelResultsTable.push({
              Backend: backend,
              BatchSize: currentBatchSize,
              InitMs: initMs.toFixed(2),
              Error: "No batches processed (check logic or sentence list)",
            });
          }
        } catch (batchError) {
          console.error(
            `      Error during embedding with batch size ${currentBatchSize}:`,
            batchError,
          );
          modelResultsTable.push({
            Backend: backend,
            BatchSize: currentBatchSize,
            InitMs: initMs.toFixed(2),
            Error: `Error after processing ${batchesProcessed} batches: ${String(batchError)}`,
          });
        }
      }
    }
    console.log(`\\nSummary for Model: ${model}`);
    console.table(modelResultsTable);
  }
}

// Expose benchmarkBackends to the background page console
(self as any).benchmarkBackends = benchmarkBackends;

(self as any).accessTabsBench = async () => {
  const t0 = performance.now();
  const tabs = await chrome.tabs.query({});
  const t1 = performance.now();
  console.log(`[BENCHMARK] Accessing tabs took ${t1 - t0} ms`);
  return tabs;
};

export default benchmarkBackends;
