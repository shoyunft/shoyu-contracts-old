import { EXCHANGE_PROXY_EIP712_DOMAIN_DEFAULT } from "../constants";
import { EIP712Domain } from "../interfaces";

/**
 * Create an exchange proxy EIP712 domain.
 */
export function createExchangeProxyEIP712Domain(
  chainId?: number,
  verifyingContract?: string
): EIP712Domain {
  return {
    ...EXCHANGE_PROXY_EIP712_DOMAIN_DEFAULT,
    ...(chainId ? { chainId } : {}),
    ...(verifyingContract ? { verifyingContract } : {}),
  };
}
