import { ethers, deployments } from "hardhat";
import { expect, use } from "chai";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { solidity } from "ethereum-waffle";

import { SignatureType } from "../utils/signature_utils";
import { NFTOrder, NFTStandard, TradeDirection } from "../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../utils/constants";
import { seedSushiswapPools } from "./fixtures/seedSushiswapPools";

use(solidity);

before(async function () {
  this.signers = await ethers.getSigners();
  this.deployer = this.signers[0];
  this.dev = this.signers[1];
  this.alice = this.signers[2];
  this.bob = this.signers[3];

  /* contract factories */
  this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.deployer);
  this.ERC721Mock = await ethers.getContractFactory("TestMintableERC721Token");
  this.ERC1155Mock = await ethers.getContractFactory(
    "TestMintableERC1155Token"
  );

  /* mock token deployments */
  this.sushi = await this.ERC20Mock.deploy("SUSHI", "SUSHI", "100000000");
  await this.sushi.deployed();

  this.erc20 = await this.ERC20Mock.deploy("TOKEN", "TOKEN", "100000000");
  await this.erc20.deployed();

  this.erc721 = await this.ERC721Mock.deploy();
  await this.erc721.deployed();

  this.erc1155 = await this.ERC1155Mock.deploy();
  await this.erc1155.deployed();

  /* get deployed contracts */
  await deployments.fixture(["ShoyuNFTOrdersFeature"]);
  this.sushiswapFactory = await ethers.getContract("UniswapV2Factory");
  this.sushiswapRouter = await ethers.getContract("UniswapV2Router02");
  this.zeroEx = await ethers.getContract("ZeroEx");
  this.weth = await ethers.getContract("WETH9Mock");

  this.shoyuEx = await ethers.getContractAt("IShoyuEx", this.zeroEx.address);
});

describe("Test buy orders with swaps", function () {
  beforeEach(async function () {
    await seedSushiswapPools({
      pairs: [
        {
          token0: this.weth,
          token0Amount: "50000",
          token1: this.sushi,
          token1Amount: "100000",
        },
        {
          token0: this.weth,
          token0Amount: "100000",
          token1: this.erc20,
          token1Amount: "50000",
        },
      ],
    });
  });

  it("Owner can sell ERC721 and swap to different ERC20", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 with weth */
    await this.weth.connect(this.alice).approve(this.shoyuEx.address, "50000");
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: BigNumber.from(5000),
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const { domain, message } = buyOrder.getEIP712TypedData();
    const types = {
      [NFTOrder.STRUCT_NAME]: NFTOrder.STRUCT_ABI,
      ["Fee"]: NFTOrder.FEE_ABI,
      ["Property"]: NFTOrder.PROPERTY_ABI,
    };

    const rawSignature = await this.alice._signTypedData(
      domain,
      types,
      message
    );
    const { v, r, s } = ethers.utils.splitSignature(rawSignature);
    const buyOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 };

    /* bob fills buy order with swap to sushi */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);
    const tx = await this.shoyuEx.connect(this.bob).sellAndSwapNFT(
      buyOrder, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.nftTokenId, // tokenId
      false, // unwrap
      this.sushi.address, // outputToken
      0 // minAmountOut
    );

    const aliceWETHBalance = await this.weth.balanceOf(this.alice.address);
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);

    expect(aliceWETHBalance).to.gt(0);
    expect(aliceERC721Balance).to.eq(1);
    expect(bobWETHBalance).to.lt(50000);
    expect(bobSUSHIBalance).to.gt(0);
    expect(bobERC721Balance).to.eq(0);
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

    const { domain, message } = buyOrder.getEIP712TypedData();
    const types = {
      [NFTOrder.STRUCT_NAME]: NFTOrder.STRUCT_ABI,
      ["Fee"]: NFTOrder.FEE_ABI,
      ["Property"]: NFTOrder.PROPERTY_ABI,
    };

    const rawSignature = await this.alice._signTypedData(
      domain,
      types,
      message
    );
    const { v, r, s } = ethers.utils.splitSignature(rawSignature);
    const buyOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 };

    /* bob fills buy order with swap to sushi */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);
    const tx = await this.shoyuEx.connect(this.bob).sellAndSwapNFT(
      buyOrder, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.nftTokenId, // tokenId
      false, // unwrap
      this.sushi.address, // outputToken
      0 // minAmountOut
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
});

describe("Test ShoyuNFT sell orders with swap", function () {
  beforeEach(async function () {
    await seedSushiswapPools({
      pairs: [
        {
          token0: this.weth,
          token0Amount: "50000",
          token1: this.sushi,
          token1Amount: "100000",
        },
        {
          token0: this.weth,
          token0Amount: "100000",
          token1: this.erc20,
          token1Amount: "50000",
        },
      ],
    });
  });

  it("Buyer can swap and fill sell order and pay with any currency", async function () {
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
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const { domain, message } = sellOrder.getEIP712TypedData();
    const types = {
      [NFTOrder.STRUCT_NAME]: NFTOrder.STRUCT_ABI,
      ["Fee"]: NFTOrder.FEE_ABI,
      ["Property"]: NFTOrder.PROPERTY_ABI,
    };

    const rawSignature = await this.alice._signTypedData(
      domain,
      types,
      message
    );
    const { v, r, s } = ethers.utils.splitSignature(rawSignature);
    const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 };

    /* bob fills sell order and swaps SUSHI to ETH to fill order */
    await this.sushi.connect(this.bob).approve(this.shoyuEx.address, "5000");
    const tx = await this.shoyuEx.connect(this.bob).buyAndSwapNFT(
      sellOrder, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "1", // nftBuyAmount
      [
        {
          inputToken: this.sushi.address,
          maxAmountIn: MaxUint256,
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
    expect(bobSUSHIBalance).to.lt("5000");
  });

  it("Buyer can swap and fill sell order and pay with multiple currencies", async function () {
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
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(69),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const { domain, message } = sellOrder.getEIP712TypedData();
    const types = {
      [NFTOrder.STRUCT_NAME]: NFTOrder.STRUCT_ABI,
      ["Fee"]: NFTOrder.FEE_ABI,
      ["Property"]: NFTOrder.PROPERTY_ABI,
    };

    const rawSignature = await this.alice._signTypedData(
      domain,
      types,
      message
    );
    const { v, r, s } = ethers.utils.splitSignature(rawSignature);
    const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 };

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
          maxAmountIn: MaxUint256,
          amountOut: sellOrder.erc20TokenAmount.mul(3).div(4),
        }, // pay 3/4 with sushi
        {
          path: [this.erc20.address, this.weth.address],
          maxAmountIn: MaxUint256,
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
});
