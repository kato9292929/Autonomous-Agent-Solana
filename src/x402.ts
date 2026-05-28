import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";
import type { PaymentRequirements } from "@x402/core/types";

const MAX_USDC = BigInt(3_000_000); // $3.00 USDC (6 decimals) — covers weekly $3.00 reports

// CAIP-2 identifier for Solana mainnet (matches @x402/svm SOLANA_MAINNET_CAIP2)
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

let _fetchWithPayment:
  | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
  | null = null;

export async function initX402Fetch(): Promise<void> {
  const secret = process.env.SOLANA_PRIVATE_KEY;
  if (!secret) {
    throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
  }

  // SOLANA_PRIVATE_KEY is the base58-encoded 64-byte secret key
  // (the format Phantom / Solana CLI export — private key + public key concatenated).
  const secretBytes = bs58.decode(secret);
  if (secretBytes.length !== 64) {
    throw new Error(
      `SOLANA_PRIVATE_KEY must decode to 64 bytes (got ${secretBytes.length})`
    );
  }

  const keypairSigner = await createKeyPairSignerFromBytes(secretBytes);
  const solanaSigner = toClientSvmSigner(keypairSigner);
  const svmScheme = new ExactSvmScheme(solanaSigner);

  const client = new x402Client()
    // v2 servers: CAIP-2 network identifier for Solana mainnet
    .register(SOLANA_MAINNET, svmScheme)
    // v1 servers: legacy network name ("solana")
    .registerV1("solana", svmScheme)
    // Block requests priced above our cap
    .registerPolicy(
      (_version: number, reqs: PaymentRequirements[]) =>
        reqs.filter((r) => {
          try {
            return BigInt(r.amount) <= MAX_USDC;
          } catch {
            return false;
          }
        })
    );

  _fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log(`[x402] initialized chain=solana signer=${keypairSigner.address}`);
}

export function fetchWithPayment(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!_fetchWithPayment) {
    throw new Error("x402 fetch not initialized. Call initX402Fetch() first.");
  }
  return _fetchWithPayment(input, init);
}
