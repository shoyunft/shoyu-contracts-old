import { ethers, deployments } from "hardhat";

export const seedSushiswapPool = deployments.createFixture(
  async (
    {
      deployments,
      ethers: {
        getNamedSigners,
        constants: { MaxUint256 },
      },
    },
    options
  ) => {
    await deployments.fixture(["ShoyuERC721OrdersFeature"], {
      keepExistingDeployments: true,
    });

    const { deployer } = await getNamedSigners();

    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");
    const sushiswapFactory = await ethers.getContract("UniswapV2Factory");
    const sushiswapRouter = await ethers.getContract("UniswapV2Router02");

    const pair = await sushiswapFactory.createPair(
      options.token0.address,
      options.token1.address
    );

    await UniswapV2Pair.attach((await pair.wait()).events[0].args.pair);

    await options.token0
      .connect(deployer)
      .deposit({ value: options.token0Amount });
    await options.token1.transfer(deployer.address, options.token1Amount);

    await options.token0
      .connect(deployer)
      .approve(sushiswapRouter.address, MaxUint256);
    await options.token1
      .connect(deployer)
      .approve(sushiswapRouter.address, MaxUint256);

    await sushiswapRouter
      .connect(deployer)
      .addLiquidity(
        options.token0.address,
        options.token1.address,
        options.token0Amount,
        options.token1Amount,
        0,
        0,
        deployer.address,
        MaxUint256
      );

    // console.log("addLiquidity", await resp.wait());
  }
);
