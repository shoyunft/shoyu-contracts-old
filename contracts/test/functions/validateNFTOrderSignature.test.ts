import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { expect } from "chai";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";

export function validateNFTOrderSignature() {
  it("Succeeds for a valid EIP-712 signature", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const signature = await order.sign(this.alice);

    await expect(this.shoyuEx.validateNFTOrderSignature(order, signature)).to
      .not.be.reverted;
  });

  it("Reverts for an invalid EIP-712 signature", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    // signed by bob instead of order maker (alice)
    const signature = await order.sign(this.bob);

    await expect(this.shoyuEx.validateNFTOrderSignature(order, signature)).to.be
      .reverted;
  });
}
