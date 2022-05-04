import { hexUtils } from "@0x/utils";
import { EXCHANGE_PROXY_DOMAIN_TYPEHASH } from "../constants";
import { createExchangeProxyEIP712Domain } from "./createExchangeProxyEIP712Domain";

/**
 * Get the hash of the exchange proxy EIP712 domain.
 */
export function getExchangeProxyEIP712DomainHash(
  chainId?: number,
  verifyingContract?: string
): string {
  const domain = createExchangeProxyEIP712Domain(chainId, verifyingContract);
  return hexUtils.hash(
    hexUtils.concat(
      EXCHANGE_PROXY_DOMAIN_TYPEHASH,
      hexUtils.hash(hexUtils.toHex(Buffer.from(domain.name))),
      hexUtils.hash(hexUtils.toHex(Buffer.from(domain.version))),
      hexUtils.leftPad(domain.chainId),
      hexUtils.leftPad(domain.verifyingContract)
    )
  );
}
