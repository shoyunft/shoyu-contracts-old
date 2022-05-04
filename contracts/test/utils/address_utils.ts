import { hexUtils } from "@0x/utils";

/**
 * Generates a random address.
 */
export function randomAddress(): string {
  return hexUtils.random(20);
}
