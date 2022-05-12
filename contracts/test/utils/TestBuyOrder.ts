import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import {
  Fee,
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../utils/nft_orders";

class TestNFTOrder extends NFTOrder {
  constructor(fields: {
    direction: TradeDirection;
    verifyingContract: string;
    erc20Token: string;
    erc20TokenAmount: BigNumberish;
    fees?: Fee[];
    nftStandard: NFTStandard;
    nftToken: string;
    nftTokenId?: BigNumberish;
    nftTokenIds?: BigNumberish[];
    nftTokenAmount?: BigNumberish;
    nftTokenIdsMerkleRoot?: string;
    maker: string;
    taker?: string;
    nonce?: BigNumberish;
    expiry?: BigNumberish;
  }) {
    super({
      direction: fields.direction,
      maker: fields.maker,
      taker: fields.taker ?? AddressZero,
      nonce: BigNumber.from(fields.nonce ?? Date.now()),
      expiry: BigNumber.from(
        fields.expiry ?? Math.floor(Date.now() / 1000) + 3600
      ),
      erc20Token: fields.erc20Token,
      erc20TokenAmount: BigNumber.from(fields.erc20TokenAmount),
      fees: fields.fees ?? [],
      nftStandard: fields.nftStandard,
      nftToken: fields.nftToken,
      nftTokenId: BigNumber.from(fields.nftTokenId ?? 0),
      nftTokenIds: fields.nftTokenIds?.map((id) => BigNumber.from(id)) ?? [],
      nftTokenAmount: BigNumber.from(fields.nftTokenAmount ?? 1),
      nftTokenIdsMerkleRoot: fields.nftTokenIdsMerkleRoot ?? HashZero,
      chainId: 31337,
      verifyingContract: fields.verifyingContract,
    });
  }
}

export default TestNFTOrder;
