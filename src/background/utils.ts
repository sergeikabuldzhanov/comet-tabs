export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const letOtherEventsThrough = () => wait(0);

// Only removing hash because we only generate one embedding per page.
export function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}${urlObj.search}`;
  } catch (e) {
    return url;
  }
}
