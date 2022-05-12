import { expect } from "chai";

import {
  NFTStandard,
  OrderStatus,
  TradeDirection,
} from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function getNFTOrderInfo() {
  it("Returns `status.INVALID` if `nftTokenIdsMerkleRoot` is set and `nftTokenId` != 0", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 69,
      nftTokenIds: [0, 1, 2],
      maker: this.alice.address,
    });

    const orderInfo = await this.shoyuEx.getNFTOrderInfo(order);
    expect(orderInfo.status === OrderStatus.Invalid);
  });

  it("Returns `status.INVALID` if `erc20Token` is NATIVE_TOKEN on buy order", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 4,
      maker: this.alice.address,
    });

    const orderInfo = await this.shoyuEx.getNFTOrderInfo(order);
    expect(orderInfo.status === OrderStatus.Invalid);
  });
}
