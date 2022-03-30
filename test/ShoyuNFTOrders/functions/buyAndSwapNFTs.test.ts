import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../../utils/constants";

import { expect } from "chai";

export function buyAndSwapNFTs() {
  it("Buyer can purchase multiple NFTs in a single tx with 2% fee", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellPriceERC721 = BigNumber.from("420");
    const sellPriceERC1155 = BigNumber.from("100");

    const sellOrderERC721 = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: sellPriceERC721,
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
          amount: sellPriceERC721.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    const sellOrderERC1155 = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: sellPriceERC1155,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(42069),
      nftTokenAmount: BigNumber.from(2),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      fees: [
        {
          recipient: this.deployer.address,
          amount: sellPriceERC1155.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const aliceETHBalanceBefore = await this.alice.getBalance();
    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);
    const deployerETHBalanceBefore = await this.deployer.getBalance();

    /* bob fills sell order and swaps SUSHI and ERC20 to ETH to fill order */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    const tx = await this.shoyuEx.connect(this.bob).buyAndSwapNFTs(
      [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
      [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
      [1, 2], // nftBuyAmount
      [
        {
          path: [this.sushi.address, this.weth.address],
          amountInMax: MaxUint256,
          amountOut: sellOrderERC1155.erc20TokenAmount
            .add(sellOrderERC1155.fees[0].amount)
            .add(sellOrderERC721.erc20TokenAmount)
            .add(sellOrderERC721.fees[0].amount),
        },
      ], // SwapExactOutDetails
      true // revertIfIncomplete
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC721BalanceAfter = await this.erc721.balanceOf(
      this.alice.address
    );
    const aliceSUSHIBalanceAfter = await this.sushi.balanceOf(
      this.alice.address
    );
    const aliceERC1155BalanceAfter = await this.erc1155.balanceOf(
      this.alice.address,
      sellOrderERC1155.nftTokenId
    );

    const bobERC721BalanceAfter = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalanceAfter = await this.sushi.balanceOf(this.bob.address);
    const bobERC1155BalanceAfter = await this.erc1155.balanceOf(
      this.bob.address,
      sellOrderERC1155.nftTokenId
    );
    const deployerETHBalanceAfter = await this.deployer.getBalance();

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore
        .add(sellOrderERC721.erc20TokenAmount)
        .add(sellOrderERC1155.erc20TokenAmount)
    );
    expect(aliceERC721BalanceAfter).to.eq("0");
    expect(aliceERC1155BalanceAfter).to.eq("0");
    expect(aliceSUSHIBalanceAfter).to.eq("0");
    expect(bobERC721BalanceAfter).to.eq("1");
    expect(bobERC1155BalanceAfter).to.eq("2");
    expect(bobSUSHIBalanceAfter).to.lt(bobSUSHIBalanceBefore);
    expect(deployerETHBalanceAfter).to.eq(
      deployerETHBalanceBefore
        .add(sellOrderERC1155.fees[0].amount)
        .add(sellOrderERC721.fees[0].amount)
    );
  });
}
