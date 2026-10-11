/**
 * Runs `fn`, logs how long it took (even if it throws), and returns its result.
 * Used to find the real bottlenecks in cardLookup / tagLookup.
 */
export async function timed<T>(
  label: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`[perf] ${label}: ${(performance.now() - start).toFixed(1)}ms`);
  }
}
