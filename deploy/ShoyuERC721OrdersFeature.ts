import { WNATIVE_ADDRESS } from "@sushiswap/core-sdk";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running ShoyuERC721OrdersFeature deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  let wethAddress;

  if (chainId === 31337) {
    wethAddress = (await deployments.get("WETH9Mock")).address;
  } else if (chainId in WNATIVE_ADDRESS) {
    wethAddress = WNATIVE_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  const zeroExContract = await deployments.get("ZeroEx");

  const sushiswapRouter = await deployments.get("UniswapV2Router02");

  const erc721OrdersFeature = await deploy("ShoyuERC721OrdersFeature", {
    from: deployer,
    args: [zeroExContract.address, wethAddress, sushiswapRouter.address],
  });

  const erc721OrdersFeatureContract = await ethers.getContractAt(
    "ShoyuERC721OrdersFeature",
    erc721OrdersFeature.address
  );

  const migrator = await ethers.getContractAt(
    "IOwnableFeature",
    zeroExContract.address
  );

  await migrator.migrate(
    erc721OrdersFeature.address,
    erc721OrdersFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  console.log("ShoyuERC721OrdersFeature deployed");
};

export default deployFunction;

deployFunction.dependencies = ["ZeroEx", "Sushiswap"];

deployFunction.tags = ["ShoyuERC721OrdersFeature"];
