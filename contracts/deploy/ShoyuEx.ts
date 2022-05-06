import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  console.log("Running ShoyuEx deploy script");
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  const migrator = await deploy("InitialMigration", {
    from: deployer,
    args: [deployer],
  });

  const shoyuEx = await deploy("ShoyuEx", {
    from: deployer,
    args: [migrator.address],
  });

  const registry = await deploy("SimpleFunctionRegistryFeature", {
    from: deployer,
    args: [],
  });

  const ownable = await deploy("OwnableFeature", {
    from: deployer,
    args: [],
  });

  await execute(
    "InitialMigration",
    { from: deployer },
    "initializeZeroEx",
    deployer,
    shoyuEx.address,
    {
      registry: registry.address,
      ownable: ownable.address,
    }
  );

  console.log("ShoyuEx deployed at ", shoyuEx.address);
};

export default deployFunction;

deployFunction.tags = ["ShoyuEx"];
