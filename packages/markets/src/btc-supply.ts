// Bitcoin's supply is a pure function of block height: 50 BTC per block, halved every 210,000
// blocks by integer division in satoshis. No licence question: it is arithmetic on public chain data.

const SATS = 100_000_000n;
const HALVING = 210_000n;

/** Coins issued by blocks 0..height inclusive. */
export function btcSupply(height: number): number {
  if (!Number.isInteger(height) || height < 0) throw new RangeError("block height must be a non-negative integer");
  let remaining = BigInt(height) + 1n;
  let subsidy = 50n * SATS;
  let total = 0n;
  while (remaining > 0n && subsidy > 0n) {
    const blocks = remaining < HALVING ? remaining : HALVING;
    total += blocks * subsidy;
    remaining -= blocks;
    subsidy /= 2n;
  }
  return Number(total) / Number(SATS);
}
