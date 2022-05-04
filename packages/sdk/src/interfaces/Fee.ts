import { BigNumber } from "@ethersproject/bignumber";

export interface Fee {
  recipient: string;
  amount: BigNumber;
}
