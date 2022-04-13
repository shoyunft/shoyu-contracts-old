import { NFTStandard } from "../../utils/nft_orders";

import { expect } from "chai";

export function batchTransferNFTs() {
  it("Owner can transfer multiple NFTs in single tx", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice transfers multiple nfts to  */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    await expect(
      this.shoyuEx
        .connect(this.alice)
        .batchTransferNFTs(
          [this.erc721.address, this.erc1155.address],
          [NFTStandard.ERC721, NFTStandard.ERC1155],
          ["420", "42069"],
          ["1", "2"],
          this.bob.address
        )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, "420")
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.zeroEx.address,
        this.alice.address,
        this.bob.address,
        "42069",
        "2"
      );
  });

  it("Reverts if one or more NFT cannot be transferred", async function () {
    await this.erc721.mint(this.alice.address, "420");
    await this.erc1155.mint(this.alice.address, "42069", 2);

    /* alice transfers multiple nfts to  */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "420");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    await expect(
      this.shoyuEx.connect(this.alice).batchTransferNFTs(
        [this.erc721.address, this.erc1155.address],
        [NFTStandard.ERC721, NFTStandard.ERC1155],
        ["420", "42069"],
        ["1", "3"], // transfer extra 1155
        this.bob.address
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc1155.balanceOf(this.alice.address, "42069")).to.eq(
      "2"
    );
  });
}
