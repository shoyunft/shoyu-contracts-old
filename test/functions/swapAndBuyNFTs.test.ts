import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";

import { expect } from "chai";

export function swapAndBuyNFTs() {
  it("Buyer can purchase multiple NFTs with ERC20 and 2% fee", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");

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
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);

    /* bob fills sell orders by swapping SUSHI to ETH */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);

    await expect(
      await this.shoyuEx.connect(this.bob).swapAndBuyNFTs(
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
        [this.alice, this.deployer],
        [
          sellOrderERC721.erc20TokenAmount.add(
            sellOrderERC1155.erc20TokenAmount
          ),
          sellOrderERC1155.fees[0].amount.add(sellOrderERC721.fees[0].amount),
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
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
  });

  it("Buyer can purchase multiple NFTs with ERC20 & ETH and 2% fee", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");

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
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders and pays with SUSHI & ETH */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);

    await expect(
      await this.shoyuEx.connect(this.bob).swapAndBuyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        [
          {
            path: [this.sushi.address, this.weth.address],
            amountInMax: MaxUint256,
            amountOut: totalAmount.div(2),
          },
        ], // SwapExactOutDetails
        true, // revertIfIncomplete
        {
          value: totalAmount.div(2),
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
          -totalAmount.div(2),
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
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
  });

  it("Buyer can purchase multiple NFTs with ERC20, ETH, WETH and 2% fee", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");
    await this.weth.connect(this.bob).deposit({ value: "500" });

    /* alice creates sell orders for nfts */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellPriceERC721 = BigNumber.from("100");
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
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);
    const bobWETHBalanceBefore = await this.weth.balanceOf(this.bob.address);

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders and pays with SUSHI, WETH, & ETH */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    await this.weth.connect(this.bob).approve(this.shoyuEx.address, MaxUint256);

    await expect(
      await this.shoyuEx.connect(this.bob).swapAndBuyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        [
          {
            path: [this.weth.address],
            amountInMax: 0,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 4 WETH
          {
            path: [this.sushi.address, this.weth.address],
            amountInMax: MaxUint256,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 4 SUSHI
        ], // SwapExactOutDetails
        true, // revertIfIncomplete
        {
          value: totalAmount.div(2),
        } // pay with 1 / 2 ETH
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
          -totalAmount.div(2),
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
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
    expect(await this.weth.balanceOf(this.bob.address)).to.eq(
      bobWETHBalanceBefore.sub(totalAmount.div(4))
    );
  });

  it("Reverts if an order cannot be filled", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");
    await this.weth.connect(this.bob).deposit({ value: "500" });

    /* alice creates sell orders for nfts */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellPriceERC721 = BigNumber.from("100");
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
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.bob);

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders and pays with SUSHI, WETH, & ETH */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    await this.weth.connect(this.bob).approve(this.shoyuEx.address, MaxUint256);

    await expect(
      this.shoyuEx.connect(this.bob).swapAndBuyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        [
          {
            path: [this.weth.address],
            amountInMax: 0,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 4 WETH
          {
            path: [this.sushi.address, this.weth.address],
            amountInMax: MaxUint256,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 4 SUSHI
        ], // SwapExactOutDetails
        true, // revertIfIncomplete
        {
          value: totalAmount.div(2),
        } // pay with 1 / 2 ETH
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(
      await this.erc1155.balanceOf(
        this.alice.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("2");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("0");
    expect(
      await this.erc1155.balanceOf(
        this.bob.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("0");
  });

  it("Refunds buyer in ETH if one order cannot be filled and `revertIfIncomplete` is false", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);
    await this.sushi.transfer(this.bob.address, "5000");
    await this.weth.connect(this.bob).deposit({ value: "500" });

    /* alice creates sell orders for nfts */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellPriceERC721 = BigNumber.from("100");
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
        },
      ],
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.bob);

    const bobSUSHIBalanceBefore = await this.sushi.balanceOf(this.bob.address);
    const bobWETHBalanceBefore = await this.weth.balanceOf(this.bob.address);

    const totalAmount = sellOrderERC1155.erc20TokenAmount
      .add(sellOrderERC1155.fees[0].amount)
      .add(sellOrderERC721.erc20TokenAmount)
      .add(sellOrderERC721.fees[0].amount);

    /* bob fills sell orders and pays with SUSHI, WETH, & ETH */
    await this.sushi
      .connect(this.bob)
      .approve(this.shoyuEx.address, MaxUint256);
    await this.weth.connect(this.bob).approve(this.shoyuEx.address, MaxUint256);

    await expect(
      await this.shoyuEx.connect(this.bob).swapAndBuyNFTs(
        [sellOrderERC721, sellOrderERC1155], // LibNFTOrder
        [sellOrderERC721Signature, sellOrderERC1155Signature], // LibSignature
        [1, 2], // nftBuyAmount
        [
          {
            path: [this.weth.address],
            amountInMax: 0,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 2 WETH
          {
            path: [this.sushi.address, this.weth.address],
            amountInMax: MaxUint256,
            amountOut: totalAmount.div(4),
          }, // pay with 1 / 4 SUSHI
        ], // SwapExactOutDetails
        false, // revertIfIncomplete
        {
          value: totalAmount.div(2),
        } // pay with 1 / 2 ETH
      )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(
        this.alice.address,
        this.bob.address,
        sellOrderERC721.nftTokenId
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
      .to.changeEtherBalances(
        [this.alice, this.deployer, this.bob],
        [sellOrderERC721.erc20TokenAmount, sellOrderERC721.fees[0].amount, 0]
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("0");
    expect(
      await this.erc1155.balanceOf(
        this.alice.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("2");
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq("1");
    expect(
      await this.erc1155.balanceOf(
        this.bob.address,
        sellOrderERC1155.nftTokenId
      )
    ).to.eq("0");
    expect(await this.sushi.balanceOf(this.bob.address)).to.lt(
      bobSUSHIBalanceBefore
    );
    expect(await this.weth.balanceOf(this.bob.address)).to.eq(
      bobWETHBalanceBefore.sub(totalAmount.div(4))
    );
  });
}