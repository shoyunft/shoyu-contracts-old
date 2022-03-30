import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../../utils/constants";

import { expect } from "chai";

export function sellAndSwapNFT() {
  it("Owner can sell ERC721 and swap to different ERC20 with 2% fee", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 with weth & 2% marketplace fee */
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
      nonce: BigNumber.from(69),
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

    /* bob fills buy order with swap to sushi */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);
    const tx = await this.shoyuEx.connect(this.bob).sellAndSwapNFT(
      buyOrder, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.nftTokenId, // tokenId
      {
        path: [buyOrder.erc20Token, this.sushi.address],
        amountOutMin: 0,
        amountIn: buyOrder.erc20TokenAmount,
      }
    );

    const aliceWETHBalance = await this.weth.balanceOf(this.alice.address);
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);
    const deployerWETHBalance = await this.weth.balanceOf(
      this.deployer.address
    );

    expect(aliceWETHBalance).to.gt(0);
    expect(aliceERC721Balance).to.eq(1);
    expect(bobWETHBalance).to.lt(50000);
    expect(bobSUSHIBalance).to.gt(0);
    expect(bobERC721Balance).to.eq(0);
    expect(deployerWETHBalance).to.eq(buyOrder.fees[0].amount);
  });

  it("NFT can sell ERC1155 and swap to different ERC20", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "420", "1");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth.connect(this.alice).approve(this.shoyuEx.address, "50000");
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
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);
    const tx = await this.shoyuEx.connect(this.bob).sellAndSwapNFT(
      buyOrder, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.nftTokenId, // tokenId
      {
        path: [this.weth.address, this.sushi.address],
        amountOutMin: 0,
        amountIn: 0,
      }
    );

    const aliceWETHBalance = await this.weth.balanceOf(this.alice.address);
    const aliceERC1155Balance = await this.erc1155.balanceOf(
      this.alice.address,
      buyOrder.nftTokenId
    );
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC1155Balance = await this.erc1155.balanceOf(
      this.bob.address,
      buyOrder.nftTokenId
    );
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);

    expect(aliceWETHBalance).to.gt(0);
    expect(aliceERC1155Balance).to.eq(1);
    expect(bobWETHBalance).to.lt(50000);
    expect(bobSUSHIBalance).to.gt(0);
    expect(bobERC1155Balance).to.eq(0);
  });
}
