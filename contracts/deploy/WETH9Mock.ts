import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  console.log("Running WETH9Mock deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("WETH9Mock", {
    from: deployer,
    deterministicDeployment: false,
  });

  const weth9Mock = await ethers.getContract("WETH9Mock");

  console.log("WETH9Mock deployed at ", weth9Mock.address);
};

export default deployFunction;

deployFunction.tags = ["WETH9Mock"];

deployFunction.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId();
      resolve(chainId !== "31337");
    } catch (error) {
      reject(error);
    }
  });
