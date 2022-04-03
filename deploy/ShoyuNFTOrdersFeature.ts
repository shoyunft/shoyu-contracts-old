import { WNATIVE_ADDRESS } from "@sushiswap/core-sdk";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running ShoyuNFTOrdersFeature deploy script");

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

  const sushiswapFactory = await deployments.get("UniswapV2Factory");

  const shoyuNFTOrdersFeature = await deploy("ShoyuNFTOrdersFeature", {
    from: deployer,
    args: [zeroExContract.address, wethAddress, sushiswapFactory.address],
  });

  const shoyuNFTOrdersFeatureContract = await ethers.getContractAt(
    "ShoyuNFTOrdersFeature",
    shoyuNFTOrdersFeature.address
  );

  const migrator = await ethers.getContractAt(
    "IOwnableFeature",
    zeroExContract.address
  );

  await migrator.migrate(
    shoyuNFTOrdersFeature.address,
    shoyuNFTOrdersFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  console.log("ShoyuERC721OrdersFeature deployed");
};

export default deployFunction;

deployFunction.dependencies = [
  "ZeroEx",
  "ZeroExERC721OrdersFeature",
  "Sushiswap",
];

deployFunction.tags = ["ShoyuNFTOrdersFeature"];
