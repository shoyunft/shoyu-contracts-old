import { ethers, deployments } from "hardhat";
import { use } from "chai";
import { solidity } from "ethereum-waffle";

import { seedSushiswapPools } from "./fixtures";
import {
  sellAndSwapNFT,
  buyAndSwapNFT,
  buyAndSwapNFTs,
  cancelNFTOrder,
  batchCancelNFTOrders,
  buyNFT,
  sellNFT,
} from "./functions";

use(solidity);

describe("ShoyuNFTOrders", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.deployer = this.signers[0];
    this.dev = this.signers[1];
    this.alice = this.signers[2];
    this.bob = this.signers[3];

    /* contract factories */
    this.ERC20Mock = await ethers.getContractFactory(
      "ERC20Mock",
      this.deployer
    );
    this.ERC721Mock = await ethers.getContractFactory(
      "TestMintableERC721Token"
    );
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
    await deployments.fixture(["ShoyuFeatures"]);
    this.sushiswapFactory = await ethers.getContract("UniswapV2Factory");
    this.sushiswapRouter = await ethers.getContract("UniswapV2Router02");
    this.zeroEx = await ethers.getContract("ZeroEx");
    this.weth = await ethers.getContract("WETH9Mock");

    this.shoyuEx = await ethers.getContractAt("IShoyuEx", this.zeroEx.address);
  });

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

  describe("buyNFT", buyNFT.bind(this));
  describe("sellNFT", sellNFT.bind(this));
  describe("sellAndSwapNFT", sellAndSwapNFT.bind(this));
  describe("buyAndSwapNFT", buyAndSwapNFT.bind(this));
  describe("buyAndSwapNFTs", buyAndSwapNFTs.bind(this));
  describe("cancelNFTOrder", cancelNFTOrder.bind(this));
  describe("batchCancelNFTOrders", batchCancelNFTOrders.bind(this));
});
