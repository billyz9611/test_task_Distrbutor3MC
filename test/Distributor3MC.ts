import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { getBytes } from "ethers";
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";

describe("Distributor3MC", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    // deploy and test token APE
    const decimals = 18;
    const [owner, tester1, tester2, tester3, testers] =
      await ethers.getSigners();
    const Ape_Factory = await ethers.getContractFactory("MintableERC20");
    const ape = await Ape_Factory.deploy("APE", "APE", decimals);

    // deploy contract Distributor3MC
    const Distributor3MC = await ethers.getContractFactory("Distributor3MC");
    const distributor3MC = await Distributor3MC.deploy(ape.getAddress());

    // set fee for Distributor3MC
    const fee = 100 * 1000;
    await distributor3MC.setFee(fee);

    // mint test token for contract and users
    const user_token_balance = ethers.parseUnits("1000", decimals);
    const contract_token_balance = ethers.parseUnits("2000", decimals);
    await ape["mint(address,uint256)"](tester1.address, user_token_balance);
    await ape["mint(address,uint256)"](tester2.address, user_token_balance);
    await ape["mint(address,uint256)"](tester3.address, user_token_balance);

    await ape["mint(address,uint256)"](
      distributor3MC.getAddress(),
      contract_token_balance
    );
    // sent some eth to contract
    const contract_eth_balacne = ethers.parseEther("10");
    await ethers.provider.send("hardhat_setBalance", [
      await distributor3MC.getAddress(),
      ethers.solidityPacked(["uint256"], [contract_eth_balacne]),
    ]);

    // init merkle tree data
    const leave1 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [tester1.address, user_token_balance, 1]
    );
    const leave2 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [tester2.address, user_token_balance, 1]
    );
    const leave3 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [tester3.address, user_token_balance, 1]
    );
    const leaves = [leave1, leave2, leave3];
    const tree = new MerkleTree(leaves, ethers.keccak256, {
      hashLeaves: false,
      sortPairs: true,
    });
    const proof1 = tree.getHexProof(leave1);
    const proof2 = tree.getHexProof(leave2);
    const proof3 = tree.getHexProof(leave3);
    // set merkle tree root and active
    const root = tree.getHexRoot();
    await distributor3MC.setClaimRoot(root);
    await distributor3MC.toggleActive();

    return {
      ape,
      decimals,
      distributor3MC,
      owner,
      tester1,
      tester2,
      tester3,
      testers,
      user_token_balance,
      contract_token_balance,
      root,
      proof1,
      proof2,
      proof3,
      fee,
      contract_eth_balacne,
    };
  }
  describe("test cases", function () {
    it("only owner can set ClaimRoot", async function () {
      const { distributor3MC, owner, tester1, root } = await loadFixture(
        deployOneYearLockFixture
      );
      await expect(
        distributor3MC
          .connect(tester1)
          .setClaimRoot(ethers.encodeBytes32String("test_root"))
      ).to.be.revertedWithCustomError(
        distributor3MC,
        "OwnableUnauthorizedAccount"
      );
      expect(await distributor3MC.claimRoot()).to.be.eq(root);
      await distributor3MC
        .connect(owner)
        .setClaimRoot(ethers.encodeBytes32String("new_root"));
      expect(
        ethers.decodeBytes32String(await distributor3MC.claimRoot())
      ).to.be.eq("new_root");
    });

    it("only owner can set fee", async function () {
      const { distributor3MC, owner, tester1, fee } = await loadFixture(
        deployOneYearLockFixture
      );
      const test_fee = 99 * 100;
      await expect(
        distributor3MC.connect(tester1).setFee(test_fee)
      ).to.be.revertedWithCustomError(
        distributor3MC,
        "OwnableUnauthorizedAccount"
      );
      expect(await distributor3MC.fee()).to.be.eq(fee);
      await distributor3MC.connect(owner).setFee(test_fee);
      expect(await distributor3MC.fee()).to.be.eq(test_fee);
    });

    it("only owner can withdraw ETH", async function () {
      const { distributor3MC, owner, tester1, contract_eth_balacne } =
        await loadFixture(deployOneYearLockFixture);
      await expect(
        distributor3MC.connect(tester1).withdrawETH(tester1.address)
      ).to.be.revertedWithCustomError(
        distributor3MC,
        "OwnableUnauthorizedAccount"
      );
      expect(await ethers.provider.getBalance(distributor3MC)).to.be.eq(
        contract_eth_balacne
      );
      const tester1_before_balance = await ethers.provider.getBalance(
        tester1.address
      );
      await distributor3MC.connect(owner).withdrawETH(tester1.address);
      const tester1_after_balance = await ethers.provider.getBalance(
        tester1.address
      );
      expect(await ethers.provider.getBalance(distributor3MC)).to.be.eq(0);
      expect(tester1_after_balance - tester1_before_balance).to.be.eq(
        contract_eth_balacne
      );
    });

    it("only owner can withdraw token", async function () {
      const { ape, distributor3MC, owner, tester1, decimals } =
        await loadFixture(deployOneYearLockFixture);
      const withdraw_amount = ethers.parseUnits("100", decimals);
      await expect(
        distributor3MC
          .connect(tester1)
          .withdrawTokens(tester1.address, withdraw_amount)
      ).to.be.revertedWithCustomError(
        distributor3MC,
        "OwnableUnauthorizedAccount"
      );
      const before_balance = await ape.balanceOf(tester1);
      await distributor3MC
        .connect(owner)
        .withdrawTokens(tester1.address, withdraw_amount);
      const after_balance = await ape.balanceOf(tester1);
      expect(after_balance - before_balance).to.be.eq(withdraw_amount);
      await expect(
        distributor3MC
          .connect(owner)
          .withdrawTokens(tester1.address, ethers.parseUnits("100000", 18))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("only owner can toggleActive", async function () {
      const { distributor3MC, owner, tester1 } = await loadFixture(
        deployOneYearLockFixture
      );
      await expect(
        distributor3MC.connect(tester1).toggleActive()
      ).to.be.revertedWithCustomError(
        distributor3MC,
        "OwnableUnauthorizedAccount"
      );
      expect(await distributor3MC.active()).to.be.eq(true);
      await distributor3MC.connect(owner).toggleActive();
      expect(await distributor3MC.active()).to.be.eq(false);
      await distributor3MC.connect(owner).toggleActive();
      expect(await distributor3MC.active()).to.be.eq(true);
    });

    it("if claimRoot == bytes32(0), toggleActive should not be allowed, vice versa ", async function () {
      const { distributor3MC, owner, tester1 } = await loadFixture(
        deployOneYearLockFixture
      );
      await distributor3MC.connect(owner).setClaimRoot(ethers.ZeroHash);
      await expect(
        distributor3MC.connect(owner).toggleActive()
      ).to.be.revertedWithCustomError(distributor3MC, "MerkleRootNotSet");
    });

    it("if msg value >= fee, claim should not be reverted", async function () {
      const {
        distributor3MC,
        tester1,
        tester2,
        user_token_balance,
        proof1,
        proof2,
      } = await loadFixture(deployOneYearLockFixture);
      await distributor3MC
        .connect(tester1)
        .claim(proof1, user_token_balance, { value: 101 * 1000 });
      await distributor3MC
        .connect(tester2)
        .claim(proof2, user_token_balance, { value: 100 * 1000 });
    });

    it("if msg value < fee, claim should be reverted", async function () {
      const { ape, distributor3MC, tester1, user_token_balance, proof1 } =
        await loadFixture(deployOneYearLockFixture);
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 99 * 1000 })
      ).to.be.revertedWithCustomError(distributor3MC, "InsufficientFee");
    });

    it("if user have claimed, claim again should be reverted", async function () {
      const { ape, distributor3MC, tester1, user_token_balance, proof1 } =
        await loadFixture(deployOneYearLockFixture);
      await distributor3MC
        .connect(tester1)
        .claim(proof1, user_token_balance, { value: 100 * 1000 });
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      ).to.be.revertedWithCustomError(distributor3MC, "AlreadyClaimed");
    });

    it("if contract balance < claim amount, claim should be reverted", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      await distributor3MC
        .connect(tester2)
        .claim(proof2, user_token_balance, { value: 100 * 1000 });
      await distributor3MC
        .connect(tester3)
        .claim(proof3, user_token_balance, { value: 100 * 1000 });
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      ).to.be.revertedWithCustomError(distributor3MC, "InsufficientBalance");
    });

    it("if contract status is not active, claim should be reverted, vice versa", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      await distributor3MC.toggleActive();
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      ).to.be.revertedWithCustomError(distributor3MC, "NotActive");
      await distributor3MC.toggleActive();

      await distributor3MC
        .connect(tester1)
        .claim(proof1, user_token_balance, { value: 100 * 1000 });
    });

    it("if user claim successfully,merkleProofs and nonces should be updated", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      expect(await distributor3MC.nonces(tester1.address)).to.be.eq(0);
      expect(
        await distributor3MC.merkleProofs(
          ethers.solidityPackedKeccak256(["bytes32[]"], [proof1])
        )
      ).to.be.eq(false);
      await distributor3MC
        .connect(tester1)
        .claim(proof1, user_token_balance, { value: 100 * 1000 });
      expect(await distributor3MC.nonces(tester1.address)).to.be.eq(1);
      expect(
        await distributor3MC.merkleProofs(
          ethers.solidityPackedKeccak256(["bytes32[]"], [proof1])
        )
      ).to.be.eq(true);
    });

    it("if user proof is incorrect, claim should be reverted, vice versa", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof2, user_token_balance, { value: 100 * 1000 })
      ).to.be.revertedWithCustomError(distributor3MC, "InvalidMerkleProof");
      expect(
        await distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      ).to.be.ok;
    });

    it("if user claim successfully, will receive the token from contract", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      const before_token_balance = await ape.balanceOf(tester1);
      expect(
        await distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      ).to.be.ok;
      expect((await ape.balanceOf(tester1)) - before_token_balance).to.be.eq(
        user_token_balance
      );
    });

    it("if user claim successfully, will emit AirdropClaimed event", async function () {
      const {
        ape,
        distributor3MC,
        tester1,
        tester2,
        tester3,
        user_token_balance,
        proof1,
        proof2,
        proof3,
      } = await loadFixture(deployOneYearLockFixture);
      const before_token_balance = await ape.balanceOf(tester1);
      await expect(
        distributor3MC
          .connect(tester1)
          .claim(proof1, user_token_balance, { value: 100 * 1000 })
      )
        .to.emit(distributor3MC, "AirdropClaimed")
        .withArgs(tester1.address, user_token_balance);
    });
  });
});
