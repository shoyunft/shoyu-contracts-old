import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";

import { expect } from "chai";

export function buyNFTs() {
  it("Buy NFTs with native token and 2% fee", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice creates sell orders for nfts */
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
      nonce: BigNumber.from(Date.now()),
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
      nonce: BigNumber.from(Date.now()),
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

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders with ETH */
    await expect(
      await this.shoyuEx.connect(this.bob).buyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        true, // revertIfIncomplete
        {
          value: totalAmount,
        }
      )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(
        this.alice.address,
        this.bob.address,
        sellOrderERC721.nftTokenId
      )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.zeroEx.address,
        this.alice.address,
        this.bob.address,
        sellOrderERC1155.nftTokenId,
        sellOrderERC1155.nftTokenAmount
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrderERC721.direction,
        sellOrderERC721.maker,
        this.bob.address,
        sellOrderERC721.nonce,
        sellOrderERC721.erc20Token,
        sellOrderERC721.erc20TokenAmount,
        sellOrderERC721.nftToken,
        sellOrderERC721.nftTokenId,
        sellOrderERC721.nftTokenAmount
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrderERC1155.direction,
        sellOrderERC1155.maker,
        this.bob.address,
        sellOrderERC1155.nonce,
        sellOrderERC1155.erc20Token,
        sellOrderERC1155.erc20TokenAmount,
        sellOrderERC1155.nftToken,
        sellOrderERC1155.nftTokenId,
        sellOrderERC1155.nftTokenAmount
      )
      .to.changeEtherBalances(
        [this.alice, this.deployer, this.bob],
        [
          sellOrderERC721.erc20TokenAmount.add(
            sellOrderERC1155.erc20TokenAmount
          ),
          sellOrderERC1155.fees[0].amount.add(sellOrderERC721.fees[0].amount),
          -totalAmount,
        ]
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(
      await this.erc1155.balanceOf(
        this.alice.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("0");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
    expect(
      await this.erc1155.balanceOf(
        this.bob.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("2");
  });

  it("Reverts if incomplete and `revertIfIncomplete` is true", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice creates sell orders for nfts */
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) - 3600),
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
      nonce: BigNumber.from(Date.now()),
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

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders with ETH */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        true, // revertIfIncomplete
        {
          value: totalAmount,
        }
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(
      await this.erc1155.balanceOf(
        this.alice.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("2");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
    expect(
      await this.erc1155.balanceOf(
        this.bob.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("0");
  });

  it("Suceeds if incomplete and `revertIfIncomplete` is false", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice creates sell orders for nfts */
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) - 3600),
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      fees: [
        {
          recipient: this.deployer.address,
          amount: sellPriceERC1155.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    // alice only signs ERC721 order
    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders with ETH */
    await expect(
      await this.shoyuEx.connect(this.bob).buyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        false, // revertIfIncomplete
        {
          value: totalAmount,
        }
      )
    )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.zeroEx.address,
        this.alice.address,
        this.bob.address,
        sellOrderERC1155.nftTokenId,
        sellOrderERC1155.nftTokenAmount
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        sellOrderERC1155.direction,
        sellOrderERC1155.maker,
        this.bob.address,
        sellOrderERC1155.nonce,
        sellOrderERC1155.erc20Token,
        sellOrderERC1155.erc20TokenAmount,
        sellOrderERC1155.nftToken,
        sellOrderERC1155.nftTokenId,
        sellOrderERC1155.nftTokenAmount
      )
      .to.changeEtherBalances(
        [this.alice, this.deployer, this.bob],
        [
          sellOrderERC1155.erc20TokenAmount,
          sellOrderERC1155.fees[0].amount,
          -sellOrderERC1155.erc20TokenAmount.add(
            sellOrderERC1155.fees[0].amount
          ),
        ]
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(
      await this.erc1155.balanceOf(
        this.alice.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("0");
    expect(await this.sushi.balanceOf(this.alice.address)).to.eq("0");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
    expect(
      await this.erc1155.balanceOf(
        this.bob.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("2");
  });

  it("Reverts if arrays are different lengths", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice creates sell orders for nfts */
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
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
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const totalAmount = sellOrderERC1155.erc20TokenAmount.add(
      sellOrderERC721.erc20TokenAmount
    );

    /* bob calls buyNFTs with only one signature */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature], // LibSignature
        [1, 2], // nftBuyAmount
        true, // revertIfIncomplete
        {
          value: totalAmount,
        }
      )
    ).to.be.reverted;
  });
}
