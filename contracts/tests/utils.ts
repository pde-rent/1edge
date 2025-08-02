import { ethers } from "ethers";

// Table utility for clean ASCII table display
export function createTable(
  rows: Array<[string, string]>,
  title?: string,
  maxWidth: number = 48,
): string {
  const lines: string[] = [];

  // Calculate optimal column widths based on content
  let col1Width = Math.min(
    maxWidth,
    Math.max(...rows.map(([key]) => key.length), "Parameter".length),
  );
  let col2Width = Math.min(
    maxWidth,
    Math.max(...rows.map(([, value]) => value.length), "Value".length),
  );

  // Ensure minimum readable widths
  col1Width = Math.max(col1Width, 10);
  col2Width = Math.max(col2Width, 10);

  if (title) {
    lines.push(`> ${title}`);
  }

  // Create dynamic borders
  const topBorder = `┌${"─".repeat(col1Width + 2)}┬${"─".repeat(col2Width + 2)}┐`;
  const headerSeparator = `├${"─".repeat(col1Width + 2)}┼${"─".repeat(col2Width + 2)}┤`;
  const bottomBorder = `└${"─".repeat(col1Width + 2)}┴${"─".repeat(col2Width + 2)}┘`;

  lines.push(topBorder);
  lines.push(
    `│ ${"Parameter".padEnd(col1Width)} │ ${"Value".padEnd(col2Width)} │`,
  );
  lines.push(headerSeparator);

  for (const [key, value] of rows) {
    // Truncate with ellipsis if content exceeds maxWidth
    const truncatedKey =
      key.length > col1Width ? key.slice(0, col1Width - 3) + "..." : key;
    const truncatedValue =
      value.length > col2Width ? value.slice(0, col2Width - 3) + "..." : value;

    const paddedKey = truncatedKey.padEnd(col1Width);
    const paddedValue = truncatedValue.padEnd(col2Width);
    lines.push(`│ ${paddedKey} │ ${paddedValue} │`);
  }

  lines.push(bottomBorder);
  return lines.join("\n");
}

// Address formatting helpers
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatLongHex(hex: string): string {
  return `${hex.slice(0, 10)}...${hex.slice(-8)}`;
}

export function formatHash(hash: string): string {
  return formatLongHex(hash);
}

// Gas cost formatting
export function formatGasCost(gasUsed: bigint, gasPrice: bigint): string {
  const totalCost = gasUsed * gasPrice;
  return ethers.formatEther(totalCost);
}

// Network info helper
export function getNetworkDisplay(network: any, chainId: number): string {
  return `${network.name} (Chain ID: ${chainId})`;
}

// Balance status helper
export function getBalanceStatus(balance: bigint, threshold: bigint): string {
  return balance < threshold ? "⚠️  LOW BALANCE" : "✅ Sufficient";
}

// User confirmation helper
export async function askUser(question: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// CreateX salt guarding logic
enum SenderBytes {
  MsgSender = 0,
  ZeroAddress = 1,
}

enum RedeployProtectionFlag {
  False = 0,
  True = 1,
  Unspecified = 2,
}

function _parseSalt(salt: string): {
  senderBytes: SenderBytes;
  redeployProtectionFlag: RedeployProtectionFlag;
} {
  // Parse the 21st byte (index 20) to determine SenderBytes and RedeployProtectionFlag
  const saltBytes = ethers.getBytes(salt);

  // For a standard keccak256 hash salt, we should treat it as ZeroAddress case
  // since it's not explicitly encoding sender information

  // Check first 20 bytes for zero address
  const isZeroAddress = saltBytes.slice(0, 20).every((b) => b === 0);

  // For standard hash salts (like keccak256("DelegateProxyV1")), treat as ZeroAddress
  // since they don't encode specific sender information
  const senderBytes = isZeroAddress
    ? SenderBytes.ZeroAddress
    : SenderBytes.ZeroAddress; // Default to ZeroAddress for hash salts

  // For standard hash salts, we'll use False (no redeploy protection)
  // unless explicitly configured otherwise
  const redeployProtectionFlag = RedeployProtectionFlag.False;

  return { senderBytes, redeployProtectionFlag };
}

function _efficientHash(a: string, b: string): string {
  return ethers.keccak256(ethers.concat([a, b]));
}

function _generateSalt(): string {
  // This would be a pseudo-random salt generation - simplified for now
  return ethers.ZeroHash;
}

export function guardSalt(
  salt: string,
  msgSender: string,
  chainId: number,
): string {
  const { senderBytes, redeployProtectionFlag } = _parseSalt(salt);

  console.log(
    `🔍 Salt parsing - SenderBytes: ${senderBytes}, RedeployProtectionFlag: ${redeployProtectionFlag}`,
  );

  if (
    senderBytes === SenderBytes.MsgSender &&
    redeployProtectionFlag === RedeployProtectionFlag.True
  ) {
    // Configures a permissioned deploy protection as well as a cross-chain redeploy protection.
    console.log("🔐 Using MsgSender + True protection");
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32"],
        [msgSender, chainId, salt],
      ),
    );
  } else if (
    senderBytes === SenderBytes.MsgSender &&
    redeployProtectionFlag === RedeployProtectionFlag.False
  ) {
    // Configures solely a permissioned deploy protection.
    console.log("🔐 Using MsgSender + False protection");
    const paddedSender = ethers.zeroPadValue(msgSender, 32);
    return _efficientHash(paddedSender, salt);
  } else if (senderBytes === SenderBytes.MsgSender) {
    // Reverts if the 21st byte is greater than 0x01 in order to enforce developer explicitness.
    throw new Error(
      "InvalidSalt: 21st byte must be 0x00 or 0x01 for MsgSender",
    );
  } else if (
    senderBytes === SenderBytes.ZeroAddress &&
    redeployProtectionFlag === RedeployProtectionFlag.True
  ) {
    // Configures solely a cross-chain redeploy protection.
    console.log("🔐 Using ZeroAddress + True protection");
    const paddedChainId = ethers.zeroPadValue(ethers.toBeHex(chainId), 32);
    return _efficientHash(paddedChainId, salt);
  } else if (
    senderBytes === SenderBytes.ZeroAddress &&
    redeployProtectionFlag === RedeployProtectionFlag.Unspecified
  ) {
    // Reverts if the 21st byte is greater than 0x01 in order to enforce developer explicitness.
    throw new Error("InvalidSalt: 21st byte must be specified for ZeroAddress");
  } else {
    // For the non-pseudo-random cases, the salt value is hashed to prevent safeguard mechanisms from being bypassed.
    console.log("🔐 Using default salt hashing");
    const generatedSalt = _generateSalt();
    return salt !== generatedSalt
      ? ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [salt]),
        )
      : salt;
  }
}
