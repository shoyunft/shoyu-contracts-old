import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import {
  NFTOrder,
  NFTStandard,
  TradeDirection,
} from "../../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../../utils/constants";

import { expect } from "chai";

export function buyNFT() {
  it("Buyer can fill ERC721 sell order", async function () {
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderSignature = await sellOrder.sign(this.alice);

    const tx = await this.shoyuEx.connect(this.bob).buyNFT(
      sellOrder, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "1", // nftBuyAmount
      { value: sellOrder.erc20TokenAmount }
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore.add(sellOrder.erc20TokenAmount)
    );
    expect(aliceERC721Balance).to.eq("0");
    expect(bobERC721Balance).to.eq("1");
  });
}
