import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import * as path from "path";
import { createTable, formatHash, formatLongHex, formatGasCost, getNetworkDisplay, getBalanceStatus, askUser, guardSalt } from "../tests/utils";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Load .env from root directory
dotenv.config({ path: resolve(__dirname, "../../../.env") });

// Load default config to get network-specific addresses
const defaultConfigPath = path.join(__dirname, "../../1edge.config.json");
const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, "utf8"));

// Import network mapping from hardhat config
import { ETHERSCAN_NETWORKS } from "../hardhat.config";

// Check if contract is verified on Etherscan
async function isContractVerified(address: string, chainId: number, constructorArg: string): Promise<boolean> {
  const network = ETHERSCAN_NETWORKS[chainId];
  if (!network) return false;

  try {
    const command = `npx hardhat verify --network ${network} ${address} "${constructorArg}"`;
    const { stdout: result } = await execAsync(command, { cwd: path.join(__dirname, "..") });
    return result.includes("Already verified") || result.includes("Successfully verified");
  } catch (error: any) {
    if (error.stdout?.includes("Already verified")) return true;
    return false;
  }
}

// Verify contract on Etherscan
async function verifyContract(address: string, chainId: number, constructorArgs: string[]): Promise<boolean> {
  const network = ETHERSCAN_NETWORKS[chainId];
  if (!network) {
    console.log(`⚠️  Verification not supported for chain ID ${chainId}`);
    return false;
  }

  try {
    console.log(`🔍 Verifying contract on ${network}...`);
    console.log(`🔑 Using API key: ${process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.slice(0, 8) + '...' + process.env.ETHERSCAN_API_KEY.slice(-4) : 'NOT_SET'}`);
    const argsString = constructorArgs.join(' ');
    const command = `npx hardhat verify --network ${network} ${address} ${argsString}`;
    console.log(`📝 Running command: ${command}`);
    const { stdout } = await execAsync(command, { cwd: path.join(__dirname, "..") });

    if (stdout.includes("Already verified")) {
      console.log("✅ Contract was already verified");
      return true;
    } else if (stdout.includes("Successfully verified")) {
      console.log("✅ Contract verification successful");
      return true;
    } else {
      console.log("❌ Contract verification failed:", stdout);
      return false;
    }
  } catch (error: any) {
    if (error.stdout?.includes("Already verified")) {
      console.log("✅ Contract was already verified");
      return true;
    }
    console.log("❌ Contract verification failed:", error.message);
    return false;
  }
}

// Helper function to get CreateX contract instance
function getCreateXContract(address: string, signer: any) {
  const createXInterface = new ethers.Interface([
    "function deployCreate2(bytes32 salt, bytes memory initCode) external payable returns (address newContract)",
    "function computeCreate2Address(bytes32 salt, bytes32 initCodeHash) external view returns (address computedAddress)"
  ]);
  return new ethers.Contract(address, createXInterface, signer);
}

// Deterministic salt for CREATE2 deployment
const UNHASHED_SALT = "DelegateProxyV1";
const DELEGATE_PROXY_SALT = ethers.keccak256(ethers.toUtf8Bytes(UNHASHED_SALT));

async function main() {
  console.log("> Let's deploy DelegateProxy");

  // Use keeper from env as deployer/owner
  const keeperPK = process.env.KEEPER_PK;
  if (!keeperPK) {
    throw new Error("KEEPER_PK not found in environment variables");
  }

  const provider = ethers.provider;
  const keeper = new ethers.Wallet(keeperPK, provider);

  // Get network info
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // Get current gas price
  const gasPrice = await provider.getFeeData();
  const currentGasPrice = gasPrice.gasPrice || ethers.parseUnits("20", "gwei");

  // Get the appropriate LOP and CreateX addresses for this network from config
  const networkConfig = defaultConfig.networks[chainId];
  let _1inch: string;
  let createXFactory: string;

  if (chainId === 31337) {
    // For hardhat local testing, use Ethereum mainnet addresses (since hardhat is typically a local Ethereum fork)
    const ethereumConfig = defaultConfig.networks["1"];
    _1inch = ethereumConfig.aggregatorV6;
    createXFactory = ethereumConfig.createXFactory;
    console.log("  Using Ethereum mainnet addresses for hardhat local testing");
  } else if (!networkConfig || !networkConfig.aggregatorV6 || !networkConfig.createXFactory) {
    throw new Error(
      `No 1inch LOP (AggregatorV6) or CreateX factory address configured for chain ID ${chainId}`,
    );
  } else {
    _1inch = networkConfig.aggregatorV6;
    createXFactory = networkConfig.createXFactory;
  }

  // Check keeper balance
  const keeperBalance = await provider.getBalance(keeper.address);

  // Step 1: Calculate deterministic address using CREATE2
  console.log("\n🔮 Calculating CREATE2 deterministic address...");

  try {
    const DelegateProxy = await ethers.getContractFactory("DelegateProxy", keeper);

    // Get raw contract bytecode from artifacts (without constructor args)
    const contractBytecode = DelegateProxy.bytecode;

    // Encode constructor arguments (_1inch, _owner)
    const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [_1inch, keeper.address]);

    // Create the complete initCode (bytecode + constructor args)
    const initCode = contractBytecode + constructorArgs.slice(2); // Remove 0x prefix from args
    const initCodeHash = ethers.keccak256(initCode);

    // Apply CreateX salt guarding (this is what CreateX does internally)
    const guardedSalt = guardSalt(DELEGATE_PROXY_SALT, keeper.address, chainId);

    // Calculate the deterministic CREATE2 address using CreateX with guarded salt
    const createXContract = getCreateXContract(createXFactory, keeper);
    const predictedAddress = await createXContract.computeCreate2Address(guardedSalt, initCodeHash);

    // Check if contract already exists at this address
    const existingCode = await provider.getCode(predictedAddress);
    if (existingCode !== "0x") {
      console.log("⚠️  Contract already deployed at this address!");
      console.log("📍 Existing Contract Address:", predictedAddress);

      // Verify it's our contract by checking owner
      try {
        const existingContract = DelegateProxy.attach(predictedAddress) as any;
        const existingOwner = await existingContract.owner();
        console.log("👑 Existing Owner:", existingOwner);

        if (existingOwner.toLowerCase() === keeper.address.toLowerCase()) {
          console.log("✅ Contract already deployed with correct owner. Skipping deployment.");

          // Check verification status
          console.log("\n🔍 Checking contract verification status...");
          const isVerified = await isContractVerified(predictedAddress, chainId, `${_1inch} ${keeper.address}`);

          if (!isVerified) {
            const shouldVerify = await askUser("Contract is not verified. Would you like to verify it now? (yes/no): ");
            if (shouldVerify === "yes" || shouldVerify === "y") {
              await verifyContract(predictedAddress, chainId, [_1inch, keeper.address]);
            }
          } else {
            console.log("✅ Contract is already verified");
          }

          process.exit(0);
        } else {
          console.log("❌ Contract deployed but with different owner!");
          process.exit(1);
        }
      } catch (error) {
        console.log("❌ Contract exists but is not a DelegateProxy. Salt collision!");
        process.exit(1);
      }
    }

    // Calculate deployment gas based on bytecode size (static calculation)
    const bytecodeSize = (initCode.length - 2) / 2; // Remove 0x prefix and convert to bytes
    // EIP-170: 200 gas per byte for contract creation + 32000 base cost + constructor execution estimate
    const deploymentBaseCost = BigInt(32000 + bytecodeSize * 200);
    // Add estimated constructor execution cost (immutable assignments, inheritance setup)
    const constructorExecutionCost = BigInt(150000); // Ownable + ReentrancyGuard + immutable assignment
    const estimatedGas = deploymentBaseCost + constructorExecutionCost;

    console.log(`📏 Bytecode size: ${bytecodeSize} bytes`);
    console.log(`⛽ Estimated deployment gas: ${estimatedGas}`);

    // Estimate setKeeper gas (additional transaction)
    const setKeeperGas = 50000n; // Approximate gas for setKeeper call
    const totalGas = estimatedGas + setKeeperGas;
    const estimatedCost = formatGasCost(totalGas, currentGasPrice);

    // Calculate cost at different gas prices for reference
    const lowGasPrice = ethers.parseUnits("1", "gwei");
    const medGasPrice = ethers.parseUnits("10", "gwei");
    const highGasPrice = ethers.parseUnits("100", "gwei");

    // Check if user has enough funds
    const estimatedCostWei = totalGas * currentGasPrice;
    const hasEnoughFunds = keeperBalance > estimatedCostWei;

    if (!hasEnoughFunds) {
      console.log("\n> ❌ Insufficient funds for deployment!");
      console.log("  Required:", ethers.formatEther(estimatedCostWei), "ETH");
      console.log("  Available:", ethers.formatEther(keeperBalance), "ETH");
      process.exit(1);
    }

    // Step 2: Display deployment table and ask for confirmation
    const deploymentTable = createTable([
      ["Network", getNetworkDisplay(network, chainId)],
      ["Deployer/Owner", keeper.address],
      ["Initial Keeper", keeper.address],
      ["1inch LOP Address", _1inch],
      ["CreateX Factory", createXFactory],
      ["Salt (original)", `${UNHASHED_SALT} (${formatHash(DELEGATE_PROXY_SALT)})`],
      ["Salt (guarded)", formatHash(guardedSalt)],
      ["InitCode", formatLongHex(initCode)],
      ["InitCodeHash", formatHash(initCodeHash)],
      ["Target Address (CREATE2)", predictedAddress],
      ["Current Gas Price", `${ethers.formatUnits(currentGasPrice, "gwei")} gwei`],
      ["Deployment Gas", estimatedGas.toString()],
      ["SetKeeper Gas", setKeeperGas.toString()],
      ["Total Gas", totalGas.toString()],
      ["Cost @ 1 gwei", `${formatGasCost(totalGas, lowGasPrice)} ETH`],
      ["Cost @ 10 gwei", `${formatGasCost(totalGas, medGasPrice)} ETH`],
      ["Cost @ 100 gwei", `${formatGasCost(totalGas, highGasPrice)} ETH`],
      ["Cost @ current price", `${estimatedCost} ETH`],
      ["Keeper Balance", `${ethers.formatEther(keeperBalance)} ETH`],
      ["Balance Warning", getBalanceStatus(keeperBalance, ethers.parseEther("0.01"))]
    ], "DEPLOYMENT CONFIRMATION");

    console.log(`\n${deploymentTable}\n`);

    const confirmation = await askUser("< Do you want to proceed with deployment? (yes/no): ");

    if (confirmation !== "yes" && confirmation !== "y") {
      console.log("\n> ❌ Deployment cancelled by user.");
      process.exit(0);
    }

    // Step 3: Proceed with actual CREATE2 deployment
    console.log("\n> Proceeding with CREATE2 deployment via CreateX...");
    console.log("> Deploying DelegateProxy contract with CREATE2...");

    // Verify CreateX factory exists on this network
    const createXBytecode = await provider.getCode(createXFactory);
    if (createXBytecode === "0x") {
      throw new Error(`CreateX factory not deployed at ${createXFactory} on chain ${chainId}`);
    }

    // Deploy DelegateProxy using CreateX CREATE2 function
    const deployTx = await createXContract.deployCreate2(DELEGATE_PROXY_SALT, initCode, {
      gasLimit: estimatedGas + 50000n // Add buffer for CreateX overhead
    });

    const receipt = await deployTx.wait();

    // Get actual deployed address from transaction receipt
    let deployedAddress = predictedAddress;

    // Look for ContractCreation event to get the actual deployed address
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const createXInterface = new ethers.Interface([
            "event ContractCreation(address indexed newContract, bytes32 indexed salt)"
          ]);
          const parsedLog = createXInterface.parseLog(log);
          if (parsedLog && parsedLog.name === "ContractCreation") {
            deployedAddress = parsedLog.args.newContract;
            break;
          }
        } catch (e) {
          // Not a ContractCreation event, continue
        }
      }
    }

    // Connect to the deployed contract with proper typing
    const delegateProxy = DelegateProxy.attach(deployedAddress) as any;

    console.log("📤 CREATE2 transaction confirmed!");

    const address = deployedAddress;
    const addressMatches = address.toLowerCase() === predictedAddress.toLowerCase();

    // Verify deployment with better error handling
    let owner: string;
    let ownerIsDeployer = false;
    try {
      // Wait a bit for the contract to be available
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if contract has code at the deployed address
      const deployedCode = await provider.getCode(deployedAddress);
      if (deployedCode === "0x") {
        throw new Error("No contract code found at deployed address");
      }

      owner = await delegateProxy.owner();
      ownerIsDeployer = owner.toLowerCase() === keeper.address.toLowerCase();
      console.log("✅ Contract deployment successful");
    } catch (error) {
      console.log("⚠️  Contract deployment failed:", error);
      owner = "Deployment failed";
      ownerIsDeployer = false;
    }

    // Step 4: Set initial keeper
    const setKeeperTx = await delegateProxy.setKeeper(keeper.address, true);
    await setKeeperTx.wait();

    // Step 5: Get deployment transaction for cost calculation
    const deploymentTx = delegateProxy.deploymentTransaction();

    // Step 6: Final summary
    const resultRows: Array<[string, string]> = [
      ["Contract Address", address],
      ["Network", getNetworkDisplay(network, chainId)],
      ["Owner", keeper.address],
      ["Approved Keeper", keeper.address],
      ["1inch LOP", _1inch],
      ["CreateX Factory", createXFactory],
      ["Salt Used", formatHash(DELEGATE_PROXY_SALT)],
      ["Address Prediction", addressMatches ? "✅ Correct" : "❌ Mismatch"],
      ["Owner Verification", ownerIsDeployer ? "✅ Correct" : "❌ Incorrect"],
      ["Keeper Setup", "✅ Complete"]
    ];

    if (deploymentTx) {
      const deploymentReceipt = await deploymentTx.wait();
      const setKeeperReceipt = await setKeeperTx.wait();
      const totalGasUsed = deploymentReceipt!.gasUsed + setKeeperReceipt!.gasUsed;
      const actualCost = formatGasCost(totalGasUsed, deploymentTx.gasPrice || currentGasPrice);
      resultRows.push(["Actual Gas Used", totalGasUsed.toString()]);
      resultRows.push(["Actual Cost", `${actualCost} ETH`]);
    }

    // Step 7: Contract verification
    console.log("\n🔍 Checking contract verification status...");
    const isVerified = await isContractVerified(address, chainId, `${_1inch} ${keeper.address}`);

    if (!isVerified) {
      const shouldVerify = await askUser("Contract is not verified. Would you like to verify it now? (yes/no): ");
      if (shouldVerify === "yes" || shouldVerify === "y") {
        const verificationSuccess = await verifyContract(address, chainId, [_1inch, keeper.address]);
        resultRows.push(["Verification", verificationSuccess ? "✅ Successful" : "❌ Failed"]);
      } else {
        resultRows.push(["Verification", "⏭️ Skipped"]);
      }
    } else {
      resultRows.push(["Verification", "✅ Already verified"]);
    }

    resultRows.push(["Next Steps", "1. Update configuration with new address"]);
    resultRows.push(["", "2. Test contract functions"]);
    resultRows.push(["", "3. Set up monitoring and alerts"]);

    console.log(`\n${createTable(resultRows, "🎉 DEPLOYMENT SUCCESSFUL!")}`);

  } catch (error) {
    console.error("\n❌ Deployment simulation failed:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
