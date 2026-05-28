import type { RunLog } from "./types";

export function logRun(log: RunLog): void {
  const tagged = { chain: "solana", ...log };
  console.log(JSON.stringify(tagged, null, 2));
}
