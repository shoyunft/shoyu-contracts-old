import { MaxUint256 } from "@ethersproject/constants";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

import { expect } from "chai";

export function batchCancelNFTOrders() {
  it("Seller can batch cancel multiple sell orders", async function () {
    await this.erc721.mint(this.alice.address, "333");
    await this.erc1155.mint(this.alice.address, "77", 2);

    /* alice creates sell orders for nfts */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellOrderERC721 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: "333",
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const sellOrderERC1155 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: "100",
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 33377,
      nftTokenAmount: 2,
      maker: this.alice.address,
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    /* alice batch cancels sell orders */
    await expect(
      this.shoyuEx
        .connect(this.alice)
        .batchCancelNFTOrders([sellOrderERC721.nonce, sellOrderERC1155.nonce])
    )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, sellOrderERC721.nonce)
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, sellOrderERC1155.nonce);

    /* bob tries to fill sell orders and fails */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrderERC721, // LibNFTOrder
        sellOrderERC721Signature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrderERC721.erc20TokenAmount }
      )
    ).to.be.reverted;

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrderERC1155, // LibNFTOrder
        sellOrderERC1155Signature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrderERC1155.erc20TokenAmount }
      )
    ).to.be.reverted;
  });

  it("Buyer can batch cancel multiple buy orders", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");
    await this.erc1155.mint(this.bob.address, "77", 1);

    /* alice creates a buy order for bob's NFT */
    await this.weth.connect(this.alice).approve(this.shoyuEx.address, "50000");
    const buyOrderERC721 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderERC1155 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: "77",
      maker: this.alice.address,
    });

    const buyOrderERC721Signature = await buyOrderERC721.sign(this.alice);
    const buyOrderERC1155Signature = await buyOrderERC1155.sign(this.alice);

    /* alice batch cancels buy orders */
    await expect(
      this.shoyuEx
        .connect(this.alice)
        .batchCancelNFTOrders([buyOrderERC721.nonce, buyOrderERC1155.nonce])
    )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, buyOrderERC721.nonce)
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, buyOrderERC1155.nonce);

    /* bob fills buy orders and fails */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrderERC721.nftTokenId);
    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrderERC721, // LibNFTOrder
        buyOrderERC721Signature, // LibSignature
        buyOrderERC721.nftTokenId, // tokenId
        1, // order amount
        false // unwrap token
      )
    ).to.be.reverted;

    /* bob fills buy order */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, "true");
    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrderERC1155, // LibNFTOrder
        buyOrderERC1155Signature, // LibSignature
        buyOrderERC1155.nftTokenId, // tokenId
        1, // order amount
        false // unwrap token
      )
    ).to.be.reverted;
  });

  it("User can batch cancel buy and sell orders together", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.weth.connect(this.bob).deposit({ value: "50000" });
    await this.erc721.mint(this.alice.address, "333");
    await this.erc1155.mint(this.bob.address, "77", 1);

    // alice creates buy order for bob's erc1155
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 77,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    // alice creates sell order for her erc721
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);
    const sellOrderSignature = await sellOrder.sign(this.alice);

    // alice batch cancels orders
    await expect(
      this.shoyuEx
        .connect(this.alice)
        .batchCancelNFTOrders([buyOrder.nonce, sellOrder.nonce])
    )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, buyOrder.nonce)
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, sellOrder.nonce);

    // bob tries to fill orders and fails
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);
    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // order amount
        false // unwrap token
      )
    ).to.be.reverted;

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;
  });
}
