import {
  pipeline,
  ProgressCallback,
  type FeatureExtractionPipeline,
  AutoTokenizer,
  PreTrainedTokenizer,
} from "@huggingface/transformers";

export class ModelManager {
  static task = "feature-extraction" as const;
  static model = "TaylorAI/bge-micro-v2" as const;
  static MAX_TOKENS = 512;
  private static instance: Promise<FeatureExtractionPipeline> | null = null;
  private static tokenizer: Promise<PreTrainedTokenizer> | null = null;

  // Internal promise chain to ensure serial execution of embedding tasks
  // This is needed as the GPU session doesn't allow concurrent embedding generation
  // NOTE(sergei), hand off queue management to the native event loop, but can't batch embedding generation,
  // which is potentially faster if we get a lot of requests in a short period of time (i.e. batch link opening).
  // see: ./modelBenchmark.ts
  private static embeddingPromiseChain: Promise<any> = Promise.resolve();

  static async getInstance(
    progress_callback?: ProgressCallback,
  ): Promise<FeatureExtractionPipeline> {
    if (!this.instance) {
      console.log("Initializing embedding model...");
      // @ts-ignore
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        device: "webgpu",
        session_options: {
          // Suppress ONNX Runtime warnings
          logSeverityLevel: 3,
        },
      });
    }
    return this.instance;
  }

  static async getTokenizer(): Promise<PreTrainedTokenizer> {
    if (!this.tokenizer) {
      console.log("Initializing tokenizer...");
      this.tokenizer = AutoTokenizer.from_pretrained(this.model);
    }
    return this.tokenizer;
  }

  static async embed(content: string): Promise<number[]> {
    console.log("ModelManager.embed called, adding to internal queue.");
    // Return a new promise that will resolve/reject based on this specific task's outcome
    return new Promise<number[]>((resolve, reject) => {
      this.embeddingPromiseChain = this.embeddingPromiseChain
        .then(async () => {
          const startTime = performance.now();
          try {
            const extractor = await this.getInstance();
            const tokenizer = await this.getTokenizer();

            const tokens = tokenizer.encode(content);
            let tokenCount = tokens.length ?? 0;
            let trimmedContent = content;

            while (tokenCount > this.MAX_TOKENS) {
              const trimRatio = (this.MAX_TOKENS / tokenCount) * 0.9;
              trimmedContent = trimmedContent.substring(
                0,
                Math.floor(trimmedContent.length * trimRatio),
              );
              tokenCount = tokenizer.encode(trimmedContent).length;
            }

            const tensor = await extractor(trimmedContent, {
              pooling: "mean",
              normalize: true,
            });

            let embedding: number[];
            if (
              typeof tensor.data === "object" &&
              tensor.data !== null &&
              typeof tensor.data[Symbol.iterator] === "function"
            ) {
              embedding = Array.from(tensor.data as Iterable<number>);
            } else {
              throw new Error(
                "ModelManager: Unexpected embedding data format from model.",
              );
            }
            const duration = performance.now() - startTime;
            console.log(
              `ModelManager: Embedding generated in ${duration.toFixed(2)}ms. Length: ${embedding.length}`,
            );
            resolve(embedding); // Resolve the outer promise with the result
          } catch (error) {
            const duration = performance.now() - startTime;
            console.error(
              `ModelManager: Error generating embedding in ${duration.toFixed(2)}ms:`,
              error,
            );
            reject(error); // Reject the outer promise with the error
          }
        })
        .catch((chainError) => {
          // This catch is for errors in the chain linkage itself, or if a previous task in the chain
          // failed *and* didn't handle its rejection properly, which shouldn't happen with the above try/catch.
          // We still need to reject the current task's promise if the chain breaks.
          console.error(
            "ModelManager: Critical error in embedding promise chain processing:",
            chainError,
          );
          reject(chainError); // Reject the current task's promise due to chain failure
        });
    });
  }
}
