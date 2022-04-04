import { ethers, deployments } from "hardhat";

async function transfer(signer, token, amount) {
  const WETH = await ethers.getContract("WETH9Mock");

  if (token.address === WETH.address) {
    await token.connect(signer).deposit({ value: amount });
  } else {
    await token.transfer(signer.address, amount);
  }
}

export const seedSushiswapPools = deployments.createFixture(
  async (
    {
      deployments,
      ethers: {
        getNamedSigners,
        constants: { MaxUint256 },
      },
    },
    { pairs }
  ) => {
    await deployments.fixture(["ShoyuFeatures"], {
      keepExistingDeployments: true,
    });

    const { deployer } = await getNamedSigners();

    const sushiswapRouter = await ethers.getContract("UniswapV2Router02");

    for (let i = 0; i < pairs.length; i++) {
      await transfer(deployer, pairs[i].token0, pairs[i].token0Amount);
      await transfer(deployer, pairs[i].token1, pairs[i].token1Amount);

      await pairs[i].token0
        .connect(deployer)
        .approve(sushiswapRouter.address, MaxUint256);
      await pairs[i].token1
        .connect(deployer)
        .approve(sushiswapRouter.address, MaxUint256);

      await sushiswapRouter
        .connect(deployer)
        .addLiquidity(
          pairs[i].token0.address,
          pairs[i].token1.address,
          pairs[i].token0Amount,
          pairs[i].token1Amount,
          0,
          0,
          deployer.address,
          MaxUint256
        );
    }
  }
);
