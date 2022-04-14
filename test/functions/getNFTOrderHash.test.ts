import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { randomAddress } from "../utils";
import { hexUtils } from "@0x/utils";

export function getNFTOrderHash() {
  it("Returns the correct order hash for order with no fees or properties", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for order with null property", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      nftTokenProperties: [
        {
          propertyValidator: AddressZero,
          propertyData: "0x",
        },
      ],
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for order with 1 fee, 1 property", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      nftTokenProperties: [
        {
          propertyValidator: randomAddress(),
          propertyData: hexUtils.random(),
        },
      ],
      fees: [
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
          feeData: hexUtils.random(),
        },
      ],
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });

  it("Returns the correct hash for order with 2 fees, 2 properties", async function () {
    const order = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(500),
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(69),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      nftTokenProperties: [
        {
          propertyValidator: randomAddress(),
          propertyData: hexUtils.random(),
        },
        {
          propertyValidator: randomAddress(),
          propertyData: hexUtils.random(),
        },
      ],
      fees: [
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
          feeData: hexUtils.random(),
        },
        {
          recipient: randomAddress(),
          amount: BigNumber.from(Math.floor(Math.random() * 1000000)),
          feeData: hexUtils.random(),
        },
      ],
    });

    const hash = await this.shoyuEx.getNFTOrderHash(order);

    expect(hash).to.eq(order.getHash());
  });
}
