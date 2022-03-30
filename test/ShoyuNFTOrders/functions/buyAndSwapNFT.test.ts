import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../../utils/constants";

import { expect } from "chai";

export function buyAndSwapNFT() {
  it("Buyer can pay for ERC721 with a different currency from listing", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    const aliceETHBalanceBefore = await this.alice.getBalance();
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
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    /* bob fills sell order and swaps SUSHI to ETH to fill order */
    await this.sushi.connect(this.bob).approve(this.shoyuEx.address, "5000");
    const tx = await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
      sellOrder, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "1", // nftBuyAmount
      [
        {
          inputToken: this.sushi.address,
          amountInMax: MaxUint256,
          path: [this.sushi.address, this.weth.address],
          amountOut: sellOrder.erc20TokenAmount,
        },
      ] // SwapExactOutDetails
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore.add(sellOrder.erc20TokenAmount)
    );
    expect(aliceERC721Balance).to.eq("0");
    expect(aliceSUSHIBalance).to.eq("0");
    expect(bobERC721Balance).to.eq("1");
    expect(bobSUSHIBalance).to.lt(5000);
  });

  it("Buyer can pay for ERC1155 with a different currency from listing", async function () {
    await this.erc1155.mint(this.alice.address, "420", "1");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, true);
    const aliceETHBalanceBefore = await this.alice.getBalance();
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
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    /* bob fills sell order and swaps SUSHI to ETH to fill order */
    await this.sushi.connect(this.bob).approve(this.shoyuEx.address, "5000");
    const tx = await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
      sellOrder, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "1", // nftBuyAmount
      [
        {
          inputToken: this.sushi.address,
          amountInMax: MaxUint256,
          path: [this.sushi.address, this.weth.address],
          amountOut: sellOrder.erc20TokenAmount,
        },
      ] // SwapExactOutDetails
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC1155Balance = await this.erc1155.balanceOf(
      this.alice.address,
      sellOrder.nftTokenId
    );
    const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address);
    const bobERC1155Balance = await this.erc1155.balanceOf(
      this.bob.address,
      sellOrder.nftTokenId
    );
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore.add(sellOrder.erc20TokenAmount)
    );
    expect(aliceERC1155Balance).to.eq("0");
    expect(aliceSUSHIBalance).to.eq("0");
    expect(bobERC1155Balance).to.eq("1");
    expect(bobSUSHIBalance).to.lt(5000);
  });

  it("Buyer can pay for ERC721 with multiple currencies", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.sushi.transfer(this.bob.address, "5000");
    await this.erc20.transfer(this.bob.address, "6969");

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
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    const aliceETHBalanceBefore = await this.alice.getBalance();
    const bobERC20BalanceBefore = await this.erc20.balanceOf(this.bob.address);
    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);

    /* bob fills sell order and swaps SUSHI and ERC20 to ETH to fill order */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    await this.erc20
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    const tx = await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
      sellOrder, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "1", // nftBuyAmount
      [
        {
          path: [this.sushi.address, this.weth.address],
          amountInMax: MaxUint256,
          amountOut: sellOrder.erc20TokenAmount.mul(3).div(4),
        }, // pay 3/4 with sushi
        {
          path: [this.erc20.address, this.weth.address],
          amountInMax: MaxUint256,
          amountOut: sellOrder.erc20TokenAmount.div(4),
        }, // pay 1/4 with erc20
      ] // SwapExactOutDetails
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC721BalanceAfter = await this.erc721.balanceOf(
      this.alice.address
    );
    const aliceSUSHIBalanceAfter = await this.sushi.balanceOf(
      this.alice.address
    );
    const bobERC721BalanceAfter = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalanceAfter = await this.sushi.balanceOf(this.bob.address);
    const bobERC20BalanceAfter = await this.erc20.balanceOf(this.bob.address);

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore.add(sellOrder.erc20TokenAmount)
    );
    expect(aliceERC721BalanceAfter).to.eq("0");
    expect(aliceSUSHIBalanceAfter).to.eq("0");
    expect(bobERC721BalanceAfter).to.eq("1");
    expect(bobSUSHIBalanceAfter).to.lt(bobSUSHIBalanceBefore);
    expect(bobERC20BalanceAfter).to.lt(bobERC20BalanceBefore);
  });
}
