import { BigNumberish } from "@ethersproject/bignumber";

export type SwapExactInDetails = {
  path: string[];
  amountIn: BigNumberish;
  amountOutMin: BigNumberish;
};
