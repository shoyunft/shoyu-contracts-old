import { randomAddress } from "../../test/utils/address_utils";
import { ChainId } from "../enums/";
import { AddressMap } from "../types";

export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// TODO: get addresses from `deployments` dir of contract pkg
export const SHOYU_EXCHANGE_ADDRESS: AddressMap = {
  [ChainId.ETHEREUM]: randomAddress(),
  [ChainId.GÖRLI]: "0xfe6Ccd86eaBb512Ab9698B29437b304807b52e87",
  [ChainId.HARDHAT]: randomAddress(),
};

// TODO: update with valid addresses
export const PROTOCOL_FEE_RECIPIENT: AddressMap = {
  [ChainId.ETHEREUM]: randomAddress(),
  [ChainId.GÖRLI]: randomAddress(),
  [ChainId.HARDHAT]: randomAddress(),
};

export { WETH9_ADDRESS } from "@sushiswap/core-sdk";
