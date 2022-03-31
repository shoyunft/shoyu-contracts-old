import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../../utils/constants";

import { expect } from "chai";

export function cancelNFTOrder() {
  it("Seller can cancel ERC721 sell order", async function () {
    await this.erc721.mint(this.alice.address, "420");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    const sellOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: BigNumber.from(100),
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
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
    await this.erc1155.mint(this.alice.address, "420", "2");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");
    const sellOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: BigNumber.from(100),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
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
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* alice cancels buy order */
    await this.shoyuEx.connect(this.alice).cancelNFTOrder(buyOrder.nonce);

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
    await this.erc1155.mint(this.bob.address, "420", 2);

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth.connect(this.alice).approve(this.shoyuEx.address, "50000");
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(2),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* alice cancels buy order */
    await this.shoyuEx.connect(this.alice).cancelNFTOrder(buyOrder.nonce);

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

    expect(1).to.be.eq(1);
  });
}
