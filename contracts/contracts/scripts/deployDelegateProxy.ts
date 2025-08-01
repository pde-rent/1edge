import { ethers } from "hardhat";
import {ONE_INCH_LIMIT_ORDER_PROTOCOL} from "../../test/Constants"

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const limitOrderProtocol = ONE_INCH_LIMIT_ORDER_PROTOCOL;
  const DelegateProxy = await ethers.getContractFactory("DelegateProxy");
  const delegateProxy = await DelegateProxy.deploy(limitOrderProtocol);

  await delegateProxy.waitForDeployment();
  console.log("DelegateProxy deployed at:", await delegateProxy.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
