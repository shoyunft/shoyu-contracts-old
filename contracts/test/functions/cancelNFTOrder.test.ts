import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { MaxUint256 } from "@ethersproject/constants";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function cancelNFTOrder() {
  it("Seller can cancel ERC721 sell order", async function () {
    await this.erc721.mint(this.alice.address, "33");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "33");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 33,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    /* alice cancels sell order */
    await this.shoyuEx.connect(this.alice).cancelNFTOrder(sellOrder.nonce);

    /* bob tries to fill sell order and fails */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;
  });

  it("Seller can cancel ERC1155 sell order", async function () {
    await this.erc1155.mint(this.alice.address, "33", "2");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 33,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    /* alice cancels sell order */
    await this.shoyuEx.connect(this.alice).cancelNFTOrder(sellOrder.nonce);

    /* bob tries to fill sell order and fails */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;
  });

  it("Buyer can cancel ERC721 buy order", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "33");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 33,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* alice cancels buy order */
    await expect(
      this.shoyuEx.connect(this.alice).cancelNFTOrder(buyOrder.nonce)
    )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, buyOrder.nonce);

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);
    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // order amount
        false // unwrap token
      )
    ).to.be.reverted;
  });

  it("Buyer can cancel ERC1155 buy order", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "33", 2);

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 33,
      nftTokenAmount: 2,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* alice cancels buy order */
    await expect(
      this.shoyuEx.connect(this.alice).cancelNFTOrder(buyOrder.nonce)
    )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, buyOrder.nonce);

    /* bob tries to fill buy order and fails */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, "true");
    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // amount
        false // unwrap token
      )
    ).to.be.reverted;
  });
}
