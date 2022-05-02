import { INIT_CODE_HASH, WNATIVE_ADDRESS } from "@sushiswap/core-sdk";
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

  let wethAddress, pairCodeHash;

  if (chainId === 31337) {
    wethAddress = (await deployments.get("WETH9Mock")).address;
  } else if (chainId in WNATIVE_ADDRESS) {
    wethAddress = WNATIVE_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  const sushiswapFactory = await ethers.getContract("UniswapV2Factory");
  const zeroExContract = await ethers.getContract("ZeroEx");

  if (chainId === 31337) {
    pairCodeHash = await sushiswapFactory.pairCodeHash();
  } else if (chainId in INIT_CODE_HASH) {
    pairCodeHash = INIT_CODE_HASH[chainId];
  } else {
    throw Error("No INIT_CODE_HASH!");
  }

  const migrator = await ethers.getContractAt(
    "IOwnableFeature",
    zeroExContract.address
  );

  // deploy ShoyuNFTOrdersFeature
  const shoyuNFTOrdersFeature = await deploy("ShoyuNFTOrdersFeature", {
    from: deployer,
    args: [zeroExContract.address, wethAddress],
  });

  const shoyuNFTOrdersFeatureContract = await ethers.getContractAt(
    "ShoyuNFTOrdersFeature",
    shoyuNFTOrdersFeature.address
  );

  await migrator.migrate(
    shoyuNFTOrdersFeature.address,
    shoyuNFTOrdersFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  // deploy ShoyuNFTSellOrdersFeature
  const shoyuNFTSellOrdersFeature = await deploy("ShoyuNFTSellOrdersFeature", {
    from: deployer,
    args: [
      zeroExContract.address,
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
    ],
  });

  const shoyuNFTSellOrdersFeatureContract = await ethers.getContractAt(
    "ShoyuNFTSellOrdersFeature",
    shoyuNFTSellOrdersFeature.address
  );

  await migrator.migrate(
    shoyuNFTSellOrdersFeature.address,
    shoyuNFTSellOrdersFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  // deploy ShoyuNFTBuyOrdersFeature
  const shoyuNFTBuyOrdersFeature = await deploy("ShoyuNFTBuyOrdersFeature", {
    from: deployer,
    args: [
      zeroExContract.address,
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
    ],
  });

  const shoyuNFTBuyOrdersFeatureContract = await ethers.getContractAt(
    "ShoyuNFTBuyOrdersFeature",
    shoyuNFTBuyOrdersFeature.address
  );

  await migrator.migrate(
    shoyuNFTBuyOrdersFeature.address,
    shoyuNFTBuyOrdersFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  // deploy ShoyuNFTTransferFeature
  const shoyuNFTTransferFeature = await deploy("ShoyuNFTTransferFeature", {
    from: deployer,
    args: [wethAddress],
  });

  const shoyuNFTTransferFeatureContract = await ethers.getContractAt(
    "ShoyuNFTTransferFeature",
    shoyuNFTTransferFeature.address
  );

  await migrator.migrate(
    shoyuNFTTransferFeature.address,
    shoyuNFTTransferFeatureContract.interface.encodeFunctionData("migrate"),
    deployer
  );

  console.log("ShoyuFeatures deployed");
};

export default deployFunction;

deployFunction.dependencies = ["ZeroEx", "Sushiswap"];

deployFunction.tags = ["ShoyuFeatures"];
