import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { WNATIVE_ADDRESS } from "@sushiswap/core-sdk";
import { AddressZero } from "@ethersproject/constants";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Deploy ZeroEx with FullMigration");
  const { deploy, execute } = deployments;

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

  const fullMigration = await deploy("FullMigration", {
    from: deployer,
    args: [deployer],
  });
  const fullMigrationContract = await ethers.getContract("FullMigration");

  const zeroEx = await deploy("ZeroEx", {
    from: deployer,
    args: [await fullMigrationContract.getBootstrapper()],
  });
  const zeroExContract = await ethers.getContract("ZeroEx");

  const registry = await deploy("SimpleFunctionRegistryFeature", {
    from: deployer,
    args: [],
  });

  const ownable = await deploy("OwnableFeature", {
    from: deployer,
    args: [],
  });

  const feeCollectorController = await deploy("FeeCollectorController", {
    from: deployer,
    args: [wethAddress, AddressZero],
  });

  const transformERC20 = await deploy("TransformERC20Feature", {
    from: deployer,
    args: [],
  });

  const metaTransactions = await deploy("MetaTransactionsFeature", {
    from: deployer,
    args: [zeroEx.address],
  });

  const nativeOrders = await deploy("NativeOrdersFeature", {
    from: deployer,
    args: [
      zeroEx.address,
      wethAddress,
      AddressZero,
      feeCollectorController.address,
      70e3,
    ],
  });

  const otcOrders = await deploy("OtcOrdersFeature", {
    from: deployer,
    args: [zeroEx.address, wethAddress],
  });

  await execute(
    "FullMigration",
    { from: deployer },
    "migrateZeroEx",
    deployer,
    zeroEx.address,
    {
      registry: registry.address,
      ownable: ownable.address,
      transformERC20: transformERC20.address,
      metaTransactions: metaTransactions.address,
      nativeOrders: nativeOrders.address,
      otcOrders: otcOrders.address,
    },
    {
      transformerDeployer: deployer,
      zeroExAddress: zeroEx.address,
      feeCollectorController: feeCollectorController.address,
    }
  );

  console.log("ZeroEx deployed at ", zeroEx.address);
};

export default deployFunction;

deployFunction.dependencies = ["WETH9Mock"];

deployFunction.tags = ["ZeroEx"];
