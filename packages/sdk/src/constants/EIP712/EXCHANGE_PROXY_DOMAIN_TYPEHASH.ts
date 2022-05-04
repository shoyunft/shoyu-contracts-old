import { hexUtils } from "@0x/utils";

export const EXCHANGE_PROXY_DOMAIN_TYPEHASH = hexUtils.hash(
  hexUtils.toHex(
    Buffer.from(
      [
        "EIP712Domain(",
        [
          "string name",
          "string version",
          "uint256 chainId",
          "address verifyingContract",
        ].join(","),
        ")",
      ].join("")
    )
  )
);
