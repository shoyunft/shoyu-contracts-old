import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { MaxUint256 } from "@ethersproject/constants";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import TestNFTOrder from "../utils/TestBuyOrder";

export function sellAndSwapNFT() {
  it("Seller can sell ERC721 and swap to different ERC20 with 2% fee", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 with weth & 2% marketplace fee */
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
      nftTokenId: 333,
      maker: this.alice.address,
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
        },
      ],
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with swap to sushi */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellAndSwapNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          buyOrder.nftTokenAmount, // tokenAmount
          {
            path: [buyOrder.erc20Token, this.sushi.address],
            amountOutMin: 0,
            amountIn: buyOrder.erc20TokenAmount,
          },
          [] // tokenIdMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, buyOrder.nftTokenId)
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.shoyuEx.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          buyOrder.nftTokenId,
          buyOrder.nftTokenAmount
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.deployer],
      [
        -buyOrder.erc20TokenAmount.add(buyOrder.fees[0].amount),
        buyOrder.fees[0].amount,
      ]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
    expect(await this.sushi.balanceOf(this.bob.address)).to.gt(0);
  });

  it("Seller can sell ERC1155 and swap to different ERC20", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "1");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellAndSwapNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          buyOrder.nftTokenAmount, // tokenAmount
          {
            path: [this.weth.address, this.sushi.address],
            amountOutMin: 0,
            amountIn: buyOrder.erc20TokenAmount,
          }, // swap details
          [] // tokenIdMerkleProof
        )
      )
        .to.emit(this.erc1155, "TransferSingle")
        .withArgs(
          this.shoyuEx.address,
          this.bob.address,
          this.alice.address,
          buyOrder.nftTokenId,
          buyOrder.nftTokenAmount
        )
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.shoyuEx.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          buyOrder.nftTokenId,
          buyOrder.nftTokenAmount
        )
    ).to.changeTokenBalance(this.weth, this.alice, -buyOrder.erc20TokenAmount);

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(1);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(0);
    expect(await this.sushi.balanceOf(this.bob.address)).to.gt(0);
  });

  it("Seller can partially fill ERC1155 buy order and swap to different currency", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "2");

    /* alice creates a buy order for 4 editions of ERC1155 */
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
      nftTokenId: 333,
      nftTokenAmount: 4,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob 1/4 of buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellAndSwapNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          1, // order amount
          {
            path: [this.weth.address, this.sushi.address],
            amountOutMin: 0,
            amountIn: 0,
          }, // swap details
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc1155, "TransferSingle")
        .withArgs(
          this.shoyuEx.address,
          this.bob.address,
          this.alice.address,
          buyOrder.nftTokenId,
          1
        )
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.shoyuEx.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount.div(4),
          buyOrder.nftToken,
          buyOrder.nftTokenId,
          1
        )
    ).to.changeTokenBalance(
      this.weth,
      this.alice,
      -buyOrder.erc20TokenAmount.div(4)
    );

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(1);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(1);
    expect(await this.sushi.balanceOf(this.bob.address)).to.gt(0);
  });

  it("Reverts if invalid swap path", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "1");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(
      this.shoyuEx.connect(this.bob).sellAndSwapNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        buyOrder.nftTokenAmount, // tokenAmount
        {
          path: [this.sushi.address, this.sushi.address],
          amountOutMin: 0,
          amountIn: buyOrder.erc20TokenAmount,
        }, // swap details
        [] // tokenIdMerkleProof
      )
    ).to.be.reverted;

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(0);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(1);
  });

  it("Reverts if amountOutMin is too high", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "1");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(
      this.shoyuEx.connect(this.bob).sellAndSwapNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        buyOrder.nftTokenAmount, // tokenAmount
        {
          path: [this.weth.address, this.sushi.address],
          amountOutMin: MaxUint256,
          amountIn: buyOrder.erc20TokenAmount,
        }, // swap details
        [] // tokenIdMerkleProof
      )
    ).to.be.reverted;

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(0);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(1);
  });
}
