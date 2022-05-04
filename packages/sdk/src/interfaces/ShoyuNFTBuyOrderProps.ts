import { BigNumberish } from "@ethersproject/bignumber";
import { ChainId, NFTStandard } from "../enums";

export interface ShoyuNFTBuyOrderProps {
  chainId: ChainId;
  verifyingContract?: string;
  maker: string;
  expiry: BigNumberish;
  nonce: BigNumberish;
  erc20Token: string;
  erc20BuyAmount: BigNumberish;
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId: BigNumberish;
  nftTokenIds?: BigNumberish[];
  nftTokenAmount: BigNumberish;
  royaltyFee?: { amount: BigNumberish; recipient: string };
  taker?: string;
}
