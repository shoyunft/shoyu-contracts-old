import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  OrderStatus,
  TradeDirection,
} from "../../utils/nft_orders";
import {
  ETH_TOKEN_ADDRESS,
  MAX_TOKENID_MERKLE_ROOT,
} from "../../utils/constants";
import { randomAddress } from "../utils";

export function getNFTOrderInfo() {
  it("Returns `status.INVALID` if `nftTokenIdsMerkleRoot` is set and `nftTokenId` != 0", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenIds: [BigNumber.from(0), BigNumber.from(1), BigNumber.from(2)],
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const orderInfo = await this.shoyuEx.getNFTOrderInfo(order);
    expect(orderInfo.status === OrderStatus.Invalid);
  });

  it("Returns `status.INVALID` if `erc20Token` is NATIVE_TOKEN on buy order", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(4),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const orderInfo = await this.shoyuEx.getNFTOrderInfo(order);
    expect(orderInfo.status === OrderStatus.Invalid);
  });
}
