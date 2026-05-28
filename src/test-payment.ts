/**
 * Payment diagnostics script for @x402/fetch v2 — Solana caller.
 * Run: node dist/test-payment.js
 */
import "dotenv/config";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";

const TARGET_URL =
  process.env.TEST_URL ??
  "https://x402yi.vercel.app/api/yield/scan"; // Yield Intelligence $0.20

const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

async function diagnose(): Promise<void> {
  const secret = process.env.SOLANA_PRIVATE_KEY;
  if (!secret) {
    console.error("ERROR: SOLANA_PRIVATE_KEY is not set");
    process.exit(1);
  }

  console.log("=== x402 v2 Payment Diagnostics (Solana) ===");
  console.log(`Target URL: ${TARGET_URL}`);

  // ── Step 1: Build signer ────────────────────────────────────
  const secretBytes = bs58.decode(secret);
  if (secretBytes.length !== 64) {
    console.error(`ERROR: SOLANA_PRIVATE_KEY must decode to 64 bytes (got ${secretBytes.length})`);
    process.exit(1);
  }
  const keypairSigner = await createKeyPairSignerFromBytes(secretBytes);
  const signer = toClientSvmSigner(keypairSigner);
  console.log(`\n[1] Signer address: ${keypairSigner.address}`);

  // ── Step 2: Build x402Client ──────────────────────────────────
  const svmScheme = new ExactSvmScheme(signer);
  const client = new x402Client()
    .register(SOLANA_MAINNET, svmScheme) // v2
    .registerV1("solana", svmScheme);    // v1 compat

  console.log(`\n[2] x402Client built with ${SOLANA_MAINNET} (v2) + solana (v1)`);

  // ── Step 3: Initial request ───────────────────────────────────
  console.log("\n[3] Sending initial request (expect 402)...");
  const firstRes = await fetch(TARGET_URL);
  console.log(`    status: ${firstRes.status}`);
  const firstBody = await firstRes.text();
  console.log(`    body (first 300 chars): ${firstBody.slice(0, 300)}`);

  const paymentRequiredHeader = firstRes.headers.get("PAYMENT-REQUIRED");
  console.log(`    PAYMENT-REQUIRED header: ${paymentRequiredHeader ? paymentRequiredHeader.slice(0, 80) + "..." : "(none)"}`);

  if (firstRes.status !== 402) {
    console.warn("    WARNING: did not get 402 — stopping");
    return;
  }

  // ── Step 4: Full payment flow ───────────────────────────────────
  console.log("\n[4] Running full wrapFetchWithPayment call...");
  const fetchWithPay = wrapFetchWithPayment(fetch, client);
  let secondRes: Response;
  try {
    secondRes = await fetchWithPay(TARGET_URL);
  } catch (err) {
    console.error(`    fetchWithPayment threw: ${err}`);
    return;
  }

  console.log(`    second response status: ${secondRes.status}`);
  const paymentResponseHeader =
    secondRes.headers.get("PAYMENT-RESPONSE") ?? secondRes.headers.get("X-PAYMENT-RESPONSE");
  console.log(`    PAYMENT-RESPONSE header: ${paymentResponseHeader ? paymentResponseHeader.slice(0, 60) + "..." : "(none)"}`);

  const secondBody = await secondRes.text();
  console.log(`    body (first 400 chars):\n${secondBody.slice(0, 400)}`);

  if (!secondRes.ok) {
    console.error(`\n  ✗ Payment FAILED (HTTP ${secondRes.status})`);
    return;
  }

  // ── Step 5: Decode txHash ──────────────────────────────────────
  if (paymentResponseHeader) {
    try {
      const decoded = decodePaymentResponseHeader(paymentResponseHeader);
      console.log(`\n[5] txHash: ${decoded.transaction}`);
    } catch (err) {
      console.warn(`    decodePaymentResponseHeader error: ${err}`);
    }
  }

  console.log("\n  ✓ Payment SUCCESS");
}

diagnose().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
