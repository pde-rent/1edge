import { ethers } from "ethers";

(async () => {
  // Generate a random Ethereum wallet
  const wallet = ethers.Wallet.createRandom();
  // Display the address and private key (for test use only - never in production!)
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
})();
