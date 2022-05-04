/**
 * Valid signature types on the Exchange Proxy.
 */
export enum SignatureType {
  Illegal = 0,
  Invalid = 1,
  EIP712 = 2,
  EthSign = 3,
  PreSigned = 4,
}
