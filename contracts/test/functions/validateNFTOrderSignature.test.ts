import { expect } from "chai";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import TestNFTOrder from "../utils/TestBuyOrder";

export function validateNFTOrderSignature() {
  it("Succeeds for a valid EIP-712 signature", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 69,
      maker: this.alice.address,
    });

    const signature = await order.sign(this.alice);

    await expect(this.shoyuEx.validateNFTOrderSignature(order, signature)).to
      .not.be.reverted;
  });

  it("Reverts for an invalid EIP-712 signature", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 69,
      maker: this.alice.address,
    });

    // signed by bob instead of order maker (alice)
    const signature = await order.sign(this.bob);

    await expect(this.shoyuEx.validateNFTOrderSignature(order, signature)).to.be
      .reverted;
  });
}
