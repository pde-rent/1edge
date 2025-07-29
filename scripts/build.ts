#!/usr/bin/env bun

import { $ } from "bun";
import { join } from "path";
import { readdir } from "fs/promises";

async function build() {
  console.log("Building 1edge...");

  try {
    // Clean build directory
    await $`rm -rf build`;
    await $`mkdir -p build`;

    // Compile TypeScript
    console.log("Compiling TypeScript...");
    await $`tsc`;

    // Build frontend
    console.log("Building frontend...");
    const frontPath = join(process.cwd(), "front");
    process.chdir(frontPath);
    await $`bun run build`;
    process.chdir("..");

    // Compile contracts (skip for now until Hardhat is set up)
    console.log("Skipping smart contracts compilation...");
    // const contractsPath = join(process.cwd(), "contracts");
    // process.chdir(contractsPath);
    // await $`npx hardhat compile`;
    // process.chdir("..");

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
