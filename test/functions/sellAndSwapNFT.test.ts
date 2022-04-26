import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";

import { expect } from "chai";

export function sellAndSwapNFT() {
  it("Owner can sell ERC721 and swap to different ERC20 with 2% fee", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 with weth & 2% marketplace fee */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
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
          this.bob.address,
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

  it("Owner can sell ERC1155 and swap to different ERC20", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "420", "1");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(5000),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
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
          {
            path: [this.weth.address, this.sushi.address],
            amountOutMin: 0,
            amountIn: 0,
          },
          [] // tokenIdMerkleProof
        )
      )
        .to.emit(this.erc1155, "TransferSingle")
        .withArgs(
          this.zeroEx.address,
          this.bob.address,
          this.alice.address,
          buyOrder.nftTokenId,
          buyOrder.nftTokenAmount
        )
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.bob.address,
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
}
