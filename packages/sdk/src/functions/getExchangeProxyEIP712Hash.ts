import { hexUtils } from "@0x/utils";
import { getExchangeProxyEIP712DomainHash } from "./getExchangeProxyEIP712DomainHash";

/**
 * Compute a complete EIP712 hash given a struct hash.
 */
export function getExchangeProxyEIP712Hash(
  structHash: string,
  chainId?: number,
  verifyingContract?: string
): string {
  return hexUtils.hash(
    hexUtils.concat(
      "0x1901",
      getExchangeProxyEIP712DomainHash(chainId, verifyingContract),
      structHash
    )
  );
}
