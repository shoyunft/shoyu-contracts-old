import { ethers } from "hardhat";
import { expect } from "chai";
import { hexUtils } from "@0x/utils";
import { AddressZero } from "@ethersproject/constants";

import { randomAddress } from "./utils";
import { IShoyuNFTOrdersFeature } from "../types/IShoyuNFTOrdersFeature";

export function simpleFunctionRegistry() {
  before(async function () {
    this.testFunctionSelector = hexUtils.random(4);
  });

  it("extend() cannot be called by a non-owner", async function () {
    await expect(
      this.shoyuEx
        .connect(this.alice)
        .extend(hexUtils.random(4), randomAddress())
    ).to.be.reverted;
  });

  it("rollback() cannot be called by a non-owner", async function () {
    await expect(
      this.shoyuEx.connect(this.alice).rollback(hexUtils.random(4), AddressZero)
    ).to.be.reverted;
  });

  it("rollback() to non-zero impl reverts for unregistered function", async function () {
    await expect(
      this.shoyuEx
        .connect(this.deployer)
        .rollback(this.testFunctionSelector, randomAddress())
    ).to.be.reverted;
  });

  it("rollback() to zero impl succeeds for unregistered function", async function () {
    await expect(
      this.shoyuEx
        .connect(this.deployer)
        .rollback(this.testFunctionSelector, AddressZero)
    ).to.not.be.reverted;
  });

  it("owner can add a new function with extend()", async function () {
    await expect(
      this.shoyuEx
        .connect(this.deployer)
        .extend(this.testFunctionSelector, randomAddress())
    ).to.not.be.reverted;
  });

  it("owner can replace a function with extend()", async function () {
    const shoyuNFTOrderFeature: IShoyuNFTOrdersFeature =
      await ethers.getContractAt(
        "IShoyuNFTOrdersFeature",
        this.shoyuEx.address
      );
    const functionSelector =
      shoyuNFTOrderFeature.interface.getSighash("cancelNFTOrder");
    await expect(
      this.shoyuEx
        .connect(this.deployer)
        .extend(functionSelector, randomAddress())
    ).to.not.be.reverted;

    await expect(this.shoyuEx.connect(this.deployer).cancelNFTOrder(555)).to.not
      .be.reverted;
  });

  it("owner can zero a function with extend()", async function () {
    const shoyuNFTOrderFeature: IShoyuNFTOrdersFeature =
      await ethers.getContractAt(
        "IShoyuNFTOrdersFeature",
        this.shoyuEx.address
      );
    const functionSelector =
      shoyuNFTOrderFeature.interface.getSighash("cancelNFTOrder");
    await expect(
      this.shoyuEx.connect(this.deployer).extend(functionSelector, AddressZero)
    ).to.not.be.reverted;

    await expect(this.shoyuEx.connect(this.deployer).cancelNFTOrder(555)).to.be
      .reverted;
  });

  it("owner can rollback a function to the prior version", async function () {
    const v0 = randomAddress();
    const v1 = randomAddress();

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v0);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v1);

    await this.shoyuEx
      .connect(this.deployer)
      .rollback(this.testFunctionSelector, v0);

    const rollbackLength = await this.shoyuEx.getRollbackLength(
      this.testFunctionSelector
    );
    expect(rollbackLength).to.eq("1");
  });

  it("owner can rollback a zero function to the prior version", async function () {
    const v0 = randomAddress();
    const v1 = randomAddress();

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v1);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v0);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, AddressZero);

    await this.shoyuEx
      .connect(this.deployer)
      .rollback(this.testFunctionSelector, v0);

    const rollbackLength = await this.shoyuEx.getRollbackLength(
      this.testFunctionSelector
    );
    expect(rollbackLength).to.eq("2");
  });

  it("owner can rollback a function to a much older version", async function () {
    const v0 = randomAddress();
    const v1 = randomAddress();

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v0);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, AddressZero);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v1);

    await this.shoyuEx
      .connect(this.deployer)
      .rollback(this.testFunctionSelector, v0);

    const rollbackLength = await this.shoyuEx.getRollbackLength(
      this.testFunctionSelector
    );
    expect(rollbackLength).to.eq("1");
  });

  it("owner cannot rollback a function to a version not in history", async function () {
    const v0 = randomAddress();
    const v1 = randomAddress();

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, AddressZero);

    await this.shoyuEx
      .connect(this.deployer)
      .extend(this.testFunctionSelector, v1);

    await expect(
      this.shoyuEx
        .connect(this.deployer)
        .rollback(this.testFunctionSelector, v0)
    ).to.be.reverted;
  });
}
