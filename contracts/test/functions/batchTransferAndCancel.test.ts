import { expect } from "chai";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { ETH_TOKEN_ADDRESS } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function batchTransferAndCancel() {
  it("Owner can transfer multiple NFTs and cancel orders in single tx", async function () {
    await this.erc721.mint(this.alice.address, "3333");
    await this.erc1155.mint(this.alice.address, "55555", 2);

    /* alice creates sell orders for nfts */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "3333");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    const sellOrderERC721 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: 3333,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 3333,
      nftTokenAmount: 1,
      maker: this.alice.address,
    });

    const sellOrderERC1155 = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: ETH_TOKEN_ADDRESS,
      erc20TokenAmount: "100",
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 55555,
      nftTokenAmount: 2,
      maker: this.alice.address,
    });

    const sellOrderERC721Signature = await sellOrderERC721.sign(this.alice);
    const sellOrderERC1155Signature = await sellOrderERC1155.sign(this.alice);

    /* alice transfers multiple nfts and cancels orders  */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "3333");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    await expect(
      this.shoyuEx.connect(this.alice).batchTransferAndCancel(
        [
          {
            nftContract: this.erc721.address,
            nftTokenId: 3333,
            nftTokenAmount: 1,
            nftStandard: NFTStandard.ERC721,
          },
          {
            nftContract: this.erc1155.address,
            nftTokenId: 55555,
            nftTokenAmount: 2,
            nftStandard: NFTStandard.ERC1155,
          },
        ],
        this.bob.address,
        [sellOrderERC721.nonce, sellOrderERC1155.nonce]
      )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.alice.address, this.bob.address, "3333")
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.shoyuEx.address,
        this.alice.address,
        this.bob.address,
        "55555",
        "2"
      )
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, sellOrderERC721.nonce)
      .to.emit(this.shoyuEx, "NFTOrderCancelled")
      .withArgs(this.alice.address, sellOrderERC1155.nonce);

    /* bob tries to fill sell orders and fails */
    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrderERC721, // LibNFTOrder
        sellOrderERC721Signature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrderERC721.erc20TokenAmount }
      )
    ).to.be.reverted;

    await expect(
      this.shoyuEx.connect(this.bob).buyNFT(
        sellOrderERC1155, // LibNFTOrder
        sellOrderERC1155Signature, // LibSignature
        "1", // nftBuyAmount
        { value: sellOrderERC1155.erc20TokenAmount }
      )
    ).to.be.reverted;
  });

  it("Reverts if one or more NFT cannot be transferred", async function () {
    await this.erc721.mint(this.alice.address, "3333");
    await this.erc1155.mint(this.alice.address, "55555", 2);

    /* alice transfers multiple nfts to  */
    await this.erc721.connect(this.alice).approve(this.shoyuEx.address, "3333");
    await this.erc1155
      .connect(this.alice)
      .setApprovalForAll(this.shoyuEx.address, "true");

    await expect(
      this.shoyuEx.connect(this.alice).batchTransferAndCancel(
        {
          nftContract: this.erc721.address,
          nftTokenId: 3333,
          nftTokenAmount: 1,
          nftStandard: NFTStandard.ERC721,
        },
        {
          nftContract: this.erc1155.address,
          nftTokenId: 55555,
          nftTokenAmount: 3, // transfer extra
          nftStandard: NFTStandard.ERC1155,
        },
        this.bob.address,
        [55]
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq("1");
    expect(await this.erc1155.balanceOf(this.alice.address, "55555")).to.eq(
      "2"
    );
  });
}
