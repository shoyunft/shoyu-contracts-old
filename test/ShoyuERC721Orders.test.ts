import { ethers, deployments } from "hardhat";
import { expect, use } from "chai";
import { BigNumber } from "@0x/utils";
import { AddressZero } from "@ethersproject/constants";
import { solidity } from "ethereum-waffle";

import { SignatureType } from "../contracts/0x/utils/signature_utils";
import {
  ERC721Order,
  NFTOrder,
  TradeDirection,
} from "../contracts/0x/utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../contracts/0x/utils/constants";
import { seedSushiswapPool } from "./fixtures/seedSushiswapPool";

use(solidity);

describe("Test Shoyu ERC721 buy and sell orders with swap", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.alice = this.signers[0];
    this.bob = this.signers[1];
    this.dev = this.signers[2];
    this.minter = this.signers[3];

    /* contract factories */
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter);
    this.ERC721Mock = await ethers.getContractFactory(
      "TestMintableERC721Token"
    );

    /* mock token deployments */
    this.sushi = await this.ERC20Mock.deploy("SUSHI", "SUSHI", "100000000");
    await this.sushi.deployed();

    this.erc20 = await this.ERC20Mock.deploy("TOKEN", "TOKEN", "100000000");
    await this.erc20.deployed();

    this.erc721 = await this.ERC721Mock.deploy();
    await this.erc721.deployed();

    /* get deployed contracts */
    await deployments.fixture(["ShoyuERC721OrdersFeature"]);
    this.sushiswapFactory = await ethers.getContract("UniswapV2Factory");
    this.sushiswapRouter = await ethers.getContract("UniswapV2Router02");
    this.zeroEx = await ethers.getContract("ZeroEx");
    this.weth = await ethers.getContract("WETH9Mock");

    this.zeroEx = await ethers.getContractAt("IZeroEx", this.zeroEx.address);
  });

  beforeEach(async function () {
    await seedSushiswapPool({
      token0: this.weth,
      token1: this.sushi,
      token0Amount: "50000",
      token1Amount: "100000",
    });
  });

  it("NFT owner can fill buy order and swap to desired currency", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's nft with weth */
    await this.weth.connect(this.alice).approve(this.zeroEx.address, "50000");
    const buyOrder = new ERC721Order({
      chainId: 31337,
      verifyingContract: this.zeroEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: new BigNumber(5000),
      erc721Token: this.erc721.address,
      erc721TokenId: new BigNumber(420),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: new BigNumber(69),
      expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600),
    });

    const { domain, message } = buyOrder.getEIP712TypedData();
    const types = {
      [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
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
    await this.erc721.connect(this.bob).approve(this.zeroEx.address, "420");
    const tx = await this.zeroEx.connect(this.bob).sellAndSwapERC721(
      {
        ...buyOrder,
        expiry: buyOrder.expiry.toString(),
        nonce: buyOrder.nonce.toString(),
        erc20TokenAmount: buyOrder.erc20TokenAmount.toString(),
        erc721TokenId: buyOrder.erc721TokenId.toString(),
      }, // LibNFTOrder
      buyOrderSignature, // LibSignature
      buyOrder.erc721TokenId.toString(), // tokenId
      false, // unwrap
      "0x", // callbackData
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

  it("Buyer can swap and fill sell order and pay with any currency", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.sushi.transfer(this.bob.address, "5000");

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.zeroEx.address, "420");
    const aliceETHBalanceBefore = await this.alice.getBalance();
    const sellOrder = new ERC721Order({
      chainId: 31337,
      verifyingContract: this.zeroEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: new BigNumber(100),
      erc721Token: this.erc721.address,
      erc721TokenId: new BigNumber(420),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: new BigNumber(69),
      expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600),
    });

    const { domain, message } = sellOrder.getEIP712TypedData();
    const types = {
      [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
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
    await this.sushi.connect(this.bob).approve(this.zeroEx.address, "5000");
    const tx = await this.zeroEx.connect(this.bob).buyAndSwapERC721(
      {
        ...sellOrder,
        expiry: sellOrder.expiry.toString(),
        nonce: sellOrder.nonce.toString(),
        erc20TokenAmount: sellOrder.erc20TokenAmount.toString(),
        erc721TokenId: sellOrder.erc721TokenId.toString(),
      }, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "0x", // callbackData
      this.sushi.address, // inputToken
      "5000" // maxAmountIn
    );

    const aliceETHBalanceAfter = await this.alice.getBalance();
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);
    const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address);

    expect(aliceETHBalanceAfter).to.eq(
      aliceETHBalanceBefore.add(sellOrder.erc20TokenAmount.toString())
    );
    expect(aliceERC721Balance).to.eq("0");
    expect(aliceSUSHIBalance).to.eq("0");
    expect(bobERC721Balance).to.eq("1");
    expect(bobSUSHIBalance).to.lt("5000");
  });
});
