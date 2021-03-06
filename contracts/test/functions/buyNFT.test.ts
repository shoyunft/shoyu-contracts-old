import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function buyNFT() {
  it("Buyer can fill ERC721 sell order", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      await this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    )
      .to.changeEtherBalances(
        [this.alice, this.bob],
        [sellOrder.erc20TokenAmount, -sellOrder.erc20TokenAmount]
      )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, sellOrder.nftTokenId)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrder.direction,
        sellOrder.maker,
        this.bob.address,
        sellOrder.nonce,
        sellOrder.erc20Token,
        sellOrder.erc20TokenAmount,
        sellOrder.nftToken,
        sellOrder.nftTokenId,
        sellOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
  });

  it("Buyer can fill partial ERC1155 sell order", async function () {
    await this.erc1155.mint(this.alice.address, "333", "20");

    /* alice creates sell order for nft, listing 20 items for 100ETH total */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 20 * 100,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      nftTokenAmount: 20,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      await this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "2", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount.div(10) }
      )
    )
      .to.changeEtherBalances(
        [this.alice, this.bob],
        [
          sellOrder.erc20TokenAmount.div(10),
          -sellOrder.erc20TokenAmount.div(10),
        ]
      )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.shoyuEx.address,
        this.alice.address,
        this.bob.address,
        sellOrder.nftTokenId,
        "2"
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrder.direction,
        sellOrder.maker,
        this.bob.address,
        sellOrder.nonce,
        sellOrder.erc20Token,
        sellOrder.erc20TokenAmount,
        sellOrder.nftToken,
        sellOrder.nftTokenId,
        "2"
      );

    expect(
      (await this.shoyuEx.getNFTOrderInfo(sellOrder)).remainingAmount
    ).to.eq("18");

    expect(
      await this.erc1155.balanceOf(this.alice.address, sellOrder.nftTokenId)
    ).to.eq("18");
    expect(
      await this.erc1155.balanceOf(this.bob.address, sellOrder.nftTokenId)
    ).to.eq("2");
  });

  it("Reverts if insufficient funds are sent", async function () {
    await this.erc721.mint(this.alice.address, "333");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount.sub(1) }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Buyer cannot fill the same sell order twice", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      await this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    )
      .to.changeEtherBalances(
        [this.alice, this.bob],
        [sellOrder.erc20TokenAmount, -sellOrder.erc20TokenAmount]
      )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, sellOrder.nftTokenId)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrder.direction,
        sellOrder.maker,
        this.bob.address,
        sellOrder.nonce,
        sellOrder.erc20Token,
        sellOrder.erc20TokenAmount,
        sellOrder.nftToken,
        sellOrder.nftTokenId,
        sellOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;
  });

  it("Buyer cannot fill expired order", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
      expiry: Math.floor(Date.now() / 1000) - 3600,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Reverts if `nftBuyAmount` exceeds the order's remaing amount", async function () {
    await this.erc1155.mint(this.alice.address, "333", "2");

    /* alice creates sell order for nft, listing 2 items */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 20 * 100,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      nftTokenAmount: 2,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "3", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(
      await this.erc1155.balanceOf(this.alice.address, sellOrder.nftTokenId)
    ).to.eq("2");
    expect(
      await this.erc1155.balanceOf(this.bob.address, sellOrder.nftTokenId)
    ).to.eq("0");
  });

  it("Reverts if a buy order is provided", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.alice.address, "333");

    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 1000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: buyOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Reverts if the taker is not the taker address specified in the order", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft with alice as taker */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
      taker: this.deployer.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Succeeds if the taker is the taker address specified in the order", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft with bob as taker */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
      taker: this.bob.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      await this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    )
      .to.changeEtherBalances(
        [this.alice, this.bob],
        [sellOrder.erc20TokenAmount, -sellOrder.erc20TokenAmount]
      )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, sellOrder.nftTokenId)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrder.direction,
        sellOrder.maker,
        this.bob.address,
        sellOrder.nonce,
        sellOrder.erc20Token,
        sellOrder.erc20TokenAmount,
        sellOrder.nftToken,
        sellOrder.nftTokenId,
        sellOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
  });

  it("Reverts if an invalid signature is provided", async function () {
    await this.erc721.mint(this.alice.address, "333");

    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    // bob signs order
    const sellOrderSignature = await sellOrder.sign(this.bob);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Reverts `order.erc20Token` is not NATIVE_TOKEN", async function () {
    await this.erc721.mint(this.alice.address, "333");

    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    // bob signs order
    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
  });

  it("Excess ETH is refunded", async function () {
    await this.erc721.mint(this.alice.address, "333");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "333");
    const sellOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 100,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    await expect(
      await this.shoyuEx.connect(this.bob).buyNFT(
        sellOrder, // LibNFTOrder
        sellOrderSignature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrder.erc20TokenAmount.add(555) }
      )
    )
      .to.changeEtherBalances(
        [this.alice, this.bob],
        [sellOrder.erc20TokenAmount, -sellOrder.erc20TokenAmount]
      )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, sellOrder.nftTokenId)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrder.direction,
        sellOrder.maker,
        this.bob.address,
        sellOrder.nonce,
        sellOrder.erc20Token,
        sellOrder.erc20TokenAmount,
        sellOrder.nftToken,
        sellOrder.nftTokenId,
        sellOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
  });
}
