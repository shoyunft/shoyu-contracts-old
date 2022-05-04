import { BigNumber } from "@ethersproject/bignumber";

import { ChainId, NFTStandard, TradeDirection } from "../enums";
import { Fee } from "./Fee";

export interface ShoyuNFTOrderProps {
  direction: TradeDirection;
  maker: string;
  taker: string;
  expiry: BigNumber;
  nonce: BigNumber;
  erc20Token: string;
  erc20TokenAmount: BigNumber;
  fees: Fee[];
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId: BigNumber;
  nftTokenIds?: BigNumber[];
  nftTokenAmount: BigNumber;
  nftTokenIdsMerkleRoot?: string;
  chainId: ChainId;
  verifyingContract: string;
}
