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

    /* bob fills sell order and swaps SUSHI to ETH to fill order */
    const bobSushiBefore = await this.sushi.balanceOf(this.bob.address);
    await this.sushi.connect(this.bob).approve(this.shoyuEx.address, "5000");

    await expect(
      await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
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
      )
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
      )
      .to.changeEtherBalance(this.alice, sellOrder.erc20TokenAmount);
    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(bobSushiBefore);
  });

  it("Buyer can pay for ERC1155 with a different currency from listing", async function () {
    await this.erc1155.mint(this.alice.address, "420", "1");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, true);
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

    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);

    /* bob fills sell order and swaps SUSHI to ETH to fill order */
    await this.sushi.connect(this.bob).approve(this.shoyuEx.address, "5000");

    await expect(
      await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
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
      )
    )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.zeroEx.address,
        this.alice.address,
        this.bob.address,
        sellOrder.nftTokenId,
        sellOrder.nftTokenAmount
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
        sellOrder.nftTokenAmount
      )
      .to.changeEtherBalance(this.alice, sellOrder.erc20TokenAmount);

    expect(
      await this.erc1155.balanceOf(this.alice.address, sellOrder.nftTokenId)
    ).to.eq("0");
    expect(
      await this.erc1155.balanceOf(this.bob.address, sellOrder.nftTokenId)
    ).to.eq("1");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    const bobERC20BalanceBefore = await this.erc20.balanceOf(this.bob.address);
    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);

    /* bob fills sell order and swaps SUSHI and ERC20 to ETH to fill order */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    await this.erc20
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);

    expect(
      await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
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
      )
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
      )
      .to.changeEtherBalance(this.alice, sellOrder.erc20TokenAmount);

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
    expect(await this.erc20.balanceOf(this.bob.address)).to.lt(
      bobERC20BalanceBefore
    );
  });
}
