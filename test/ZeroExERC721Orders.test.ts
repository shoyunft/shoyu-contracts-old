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

use(solidity);

describe("Test ZeroEx ERC721 buy and sell orders", function () {
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
  });

  beforeEach(async function () {
    /* get deployed contracts */
    await deployments.fixture(["ZeroExERC721OrdersFeature"]);
    this.zeroEx = await ethers.getContract("ZeroEx");
    this.weth = await ethers.getContract("WETH9Mock");

    this.zeroEx = await ethers.getContractAt("IZeroEx", this.zeroEx.address);
  });

  it("NFT owner can fill offer (sell order)", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's nft */
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

    /* bob fills buy order */
    await this.erc721.connect(this.bob).approve(this.zeroEx.address, "420");
    const tx = await this.zeroEx.connect(this.bob).sellERC721(
      {
        ...buyOrder,
        expiry: ethers.BigNumber.from(buyOrder.expiry.toString()),
        nonce: ethers.BigNumber.from(buyOrder.nonce.toString()),
        erc20TokenAmount: ethers.BigNumber.from(
          buyOrder.erc20TokenAmount.toString()
        ),
        erc721TokenId: ethers.BigNumber.from(buyOrder.erc721TokenId.toString()),
      }, // LibNFTOrder
      buyOrderSignature, // LibSignature
      ethers.BigNumber.from(buyOrder.erc721TokenId.toString()), // tokenId
      false, // unwrap
      "0x" // callbackData
    );

    const aliceWETHBalance = await this.weth.balanceOf(this.alice.address);
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);

    expect(aliceWETHBalance).to.eq("45000");
    expect(aliceERC721Balance).to.eq("1");
    expect(bobWETHBalance).to.eq("5000");
    expect(bobERC721Balance).to.eq("0");
  });

  it("NFT owner can list an item for sale (sell order) & buyer can fill order", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.weth.connect(this.bob).deposit({ value: "50000" });

    /* alice creates sell order for nft */
    await this.erc721.connect(this.alice).approve(this.zeroEx.address, "420");
    const sellOrder = new ERC721Order({
      chainId: 31337,
      verifyingContract: this.zeroEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: new BigNumber(5000),
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

    /* bob fills sell order */
    await this.weth.connect(this.bob).approve(this.zeroEx.address, "5000");
    const tx = await this.zeroEx.connect(this.bob).buyERC721(
      {
        ...sellOrder,
        expiry: sellOrder.expiry.toString(),
        nonce: sellOrder.nonce.toString(),
        erc20TokenAmount: sellOrder.erc20TokenAmount.toString(),
        erc721TokenId: sellOrder.erc721TokenId.toString(),
      }, // LibNFTOrder
      sellOrderSignature, // LibSignature
      "0x" // callbackData
    );

    const aliceWETHBalance = await this.weth.balanceOf(this.alice.address);
    const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address);
    const bobWETHBalance = await this.weth.balanceOf(this.bob.address);
    const bobERC721Balance = await this.erc721.balanceOf(this.bob.address);

    expect(aliceWETHBalance).to.eq(sellOrder.erc20TokenAmount.toString());
    expect(aliceERC721Balance).to.eq("0");
    expect(bobWETHBalance).to.lt(50000);
    expect(bobERC721Balance).to.eq("1");
  });
});
