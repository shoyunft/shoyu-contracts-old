import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { MAX_TOKENID_MERKLE_ROOT } from "../../utils/constants";
import { randomAddress } from "../utils";
import TestNFTOrder from "../utils/TestBuyOrder";

export function getNFTOrderHash() {
  it("Returns the correct order hash for order with no fees or properties", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 69,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for collection order", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 0,
      nftTokenIdsMerkleRoot: MAX_TOKENID_MERKLE_ROOT,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for order with 1 fee & set tokenIds", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 10 }, (_, i) => i),
      maker: this.alice.address,
      fees: [
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
        },
      ],
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for order with 2 fees & set tokenIds", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 10 }, (_, i) => i),
      nftTokenAmount: 1,
      maker: this.alice.address,
      fees: [
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
        },
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
        },
      ],
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });
}
