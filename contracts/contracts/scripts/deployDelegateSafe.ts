import { ethers } from "hardhat";
import {ONE_INCH_LIMIT_ORDER_PROTOCOL} from "../../test/Constants"

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const limitOrderProtocol = ONE_INCH_LIMIT_ORDER_PROTOCOL;
  const DelegateSafe = await ethers.getContractFactory("DelegateSafe");
  const delegateSafe = await DelegateSafe.deploy(limitOrderProtocol);

  await delegateSafe.waitForDeployment();
  console.log("DelegateSafe deployed at:", await delegateSafe.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
