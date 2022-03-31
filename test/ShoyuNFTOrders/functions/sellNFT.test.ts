import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";

import { expect } from "chai";

export function sellNFT() {
  it("Seller can fill ERC721 buy order with 2% fee", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth.connect(this.alice).approve(this.shoyuEx.address, "50000");
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);
    const tx = await this.shoyuEx.connect(this.bob).sellNFT(
      buyOrder, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.nftTokenId, // tokenId
      1, // order amount
      false // unwrap token
    );

    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);

    expect(aliceERC721Balance).to.eq(1);
    expect(bobWETHBalance).to.eq(buyOrder.erc20TokenAmount);
    expect(bobERC721Balance).to.eq(0);
  });
}
