import { BigNumberish } from "@ethersproject/bignumber";

import { ChainId, NFTStandard } from "../enums";

export interface ShoyuNFTSellOrderProps {
  chainId: ChainId;
  verifyingContract?: string;
  maker: string;
  expiry: BigNumberish;
  nonce: BigNumberish;
  ethSellAmount: BigNumberish;
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId: BigNumberish;
  nftTokenAmount?: BigNumberish;
  royaltyFee?: { amount: BigNumberish; recipient: string };
  taker?: string;
}
