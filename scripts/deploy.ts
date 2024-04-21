import { ethers } from "hardhat";

async function main() {
  const test_token_name = "Ape";
  const test_token_symbol = "Ape";
  const test_token_decimals = 18;

  const ape = await ethers.deployContract("MintableERC20", [
    test_token_name,
    test_token_symbol,
    test_token_decimals,
  ]);

  await ape.waitForDeployment();
  const ape_address = await ape.getAddress();

  console.log(`ape address ${await ape.getAddress()}`);
  const distributor3MC = await ethers.deployContract("Distributor3MC", [
    ape_address,
  ]);
  await distributor3MC.waitForDeployment();

  console.log(`distributor3MC address ${await distributor3MC.getAddress()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
