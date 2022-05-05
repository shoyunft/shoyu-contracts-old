import { BigNumberish } from "@ethersproject/bignumber";
import { ChainId, NFTStandard } from "../enums";

export interface ShoyuNFTBuyOrderProps {
  chainId: ChainId;
  verifyingContract?: string;
  maker: string;
  expiry: BigNumberish;
  nonce: BigNumberish;
  wethBuyAmount: BigNumberish;
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId?: BigNumberish;
  nftTokenIds?: BigNumberish[];
  nftTokenAmount?: BigNumberish;
  royaltyFee?: { amount: BigNumberish; recipient: string };
  taker?: string;
}
