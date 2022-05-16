import { Wallet } from "@ethersproject/wallet";

/**
 * Generates a random address.
 */
export function randomAddress(): string {
  return Wallet.createRandom().address;
}
