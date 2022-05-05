import { BigNumberish } from "@ethersproject/bignumber";

export type SwapExactOutDetails = {
  path: string[];
  amountInMax: BigNumberish;
  amountOut: BigNumberish;
};
