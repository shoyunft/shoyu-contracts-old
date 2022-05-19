import {
  FACTORY_ADDRESS,
  INIT_CODE_HASH,
  WNATIVE_ADDRESS,
} from "@sushiswap/core-sdk";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running ShoyuFeatures deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  let wethAddress, pairCodeHash, sushiswapFactory;

  if (chainId === 31337) {
    wethAddress = (await deployments.get("WETH9Mock")).address;
  } else if (chainId in WNATIVE_ADDRESS) {
    wethAddress = WNATIVE_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  if (chainId === 31337) {
    sushiswapFactory = await ethers.getContract("UniswapV2Factory");
  } else if (chainId in FACTORY_ADDRESS) {
    sushiswapFactory = await ethers.getContractAt(
      "UniswapV2Factory",
      FACTORY_ADDRESS[chainId]
    );
  } else {
    throw Error("No FACTORY!");
  }

  if (chainId === 31337) {
    pairCodeHash = await sushiswapFactory.pairCodeHash();
  } else if (chainId in INIT_CODE_HASH) {
    pairCodeHash = INIT_CODE_HASH[chainId];
  } else {
    throw Error("No INIT_CODE_HASH!");
  }

  const shoyuExContract = await ethers.getContract("ShoyuEx");

  const migrator = await ethers.getContractAt(
    "IOwnableFeature",
    shoyuExContract.address
  );

  // deploy ShoyuNFTOrdersFeature
  const shoyuNFTOrdersFeature = await deploy("ShoyuNFTOrdersFeature", {
    from: deployer,
    args: [shoyuExContract.address, wethAddress],
  });

  if (shoyuNFTOrdersFeature.newlyDeployed) {
    const shoyuNFTOrdersFeatureContract = await ethers.getContractAt(
      "ShoyuNFTOrdersFeature",
      shoyuNFTOrdersFeature.address
    );

    const resp = await migrator.migrate(
      shoyuNFTOrdersFeature.address,
      shoyuNFTOrdersFeatureContract.interface.encodeFunctionData("migrate"),
      deployer
    );

    await resp.wait();
  }

  // deploy ShoyuNFTSellOrdersFeature
  const shoyuNFTSellOrdersFeature = await deploy("ShoyuNFTSellOrdersFeature", {
    from: deployer,
    args: [
      shoyuExContract.address,
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
    ],
  });

  if (shoyuNFTSellOrdersFeature.newlyDeployed) {
    const shoyuNFTSellOrdersFeatureContract = await ethers.getContractAt(
      "ShoyuNFTSellOrdersFeature",
      shoyuNFTSellOrdersFeature.address
    );

    const resp = await migrator.migrate(
      shoyuNFTSellOrdersFeature.address,
      shoyuNFTSellOrdersFeatureContract.interface.encodeFunctionData("migrate"),
      deployer
    );

    await resp.wait();
  }

  // deploy ShoyuNFTBuyOrdersFeature
  const shoyuNFTBuyOrdersFeature = await deploy("ShoyuNFTBuyOrdersFeature", {
    from: deployer,
    args: [
      shoyuExContract.address,
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
    ],
  });

  if (shoyuNFTBuyOrdersFeature.newlyDeployed) {
    const shoyuNFTBuyOrdersFeatureContract = await ethers.getContractAt(
      "ShoyuNFTBuyOrdersFeature",
      shoyuNFTBuyOrdersFeature.address
    );

    const resp = await migrator.migrate(
      shoyuNFTBuyOrdersFeature.address,
      shoyuNFTBuyOrdersFeatureContract.interface.encodeFunctionData("migrate"),
      deployer
    );
    await resp.wait();
  }

  console.log("ShoyuFeatures deployed");
};

export default deployFunction;

deployFunction.dependencies = ["ShoyuEx", "Sushiswap"];

deployFunction.tags = ["ShoyuFeatures"];
