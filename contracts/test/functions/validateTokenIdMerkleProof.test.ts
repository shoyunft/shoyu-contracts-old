import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { MAX_TOKENID_MERKLE_ROOT } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function validateTokenIdMerkleProof() {
  it("Succeeds with valid merkle proof", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 100 }, (_, i) => i),
      maker: this.alice.address,
    });

    await expect(
      this.shoyuEx.validateTokenIdMerkleProof(
        order,
        77,
        order.getMerkleProof(BigNumber.from(77))
      )
    ).to.not.be.reverted;
  });

  it("Succeeds on specified tokenId & empty proof if no root is set", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 5,
      maker: this.alice.address,
    });

    await expect(this.shoyuEx.validateTokenIdMerkleProof(order, "5", [])).to.not
      .be.reverted;
  });

  it("Succeeds on any tokenId & empty proof if root is set to 0xfff...f", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIdsMerkleRoot: MAX_TOKENID_MERKLE_ROOT,
      maker: this.alice.address,
    });

    await expect(this.shoyuEx.validateTokenIdMerkleProof(order, "5", [])).to.not
      .be.reverted;
  });

  it("Reverts on invalid merkle proof", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 10 }, (_, i) => i),
      maker: this.alice.address,
    });

    await expect(
      this.shoyuEx.validateTokenIdMerkleProof(
        {
          ...order,
          nftTokenIdsMerkleRoot:
            order.nftTokenIdsMerkleRoot.substring(0, 5) +
            "0" +
            order.nftTokenIdsMerkleRoot.substring(6),
        },
        5,
        order.getMerkleProof(BigNumber.from(5))
      )
    ).to.be.reverted;
  });

  it("Reverts on sell order", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 10 }, (_, i) => i),
      maker: this.alice.address,
    });

    await expect(
      this.shoyuEx.validateTokenIdMerkleProof(
        order,
        5,
        order.getMerkleProof(BigNumber.from(5))
      )
    ).to.be.reverted;
  });

  it("Reverts on empty proof if root is set", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIds: Array.from({ length: 10 }, (_, i) => i),
      maker: this.alice.address,
    });

    await expect(this.shoyuEx.validateTokenIdMerkleProof(order, "0", [])).to.be
      .reverted;
  });

  it("Reverts on empty proof & invalid tokenId if no root is set", async function () {
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 5,
      maker: this.alice.address,
    });

    await expect(this.shoyuEx.validateTokenIdMerkleProof(order, "6", [])).to.be
      .reverted;
  });

  it("Reverts on any tokenId & empty proof if root is set to 0xfff...e", async function () {
    const badRoot = MAX_TOKENID_MERKLE_ROOT.slice(0, -1) + "e";
    const order = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenIdsMerkleRoot: badRoot,
      maker: this.alice.address,
    });

    await expect(this.shoyuEx.validateTokenIdMerkleProof(order, "0", [])).to.be
      .reverted;
  });
}
