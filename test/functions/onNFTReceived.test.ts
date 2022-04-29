import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { AbiEncoder } from "@0x/utils";
import { SIGNATURE_ABI } from "@0x/protocol-utils";
import { BigNumber as ZeroExBN } from "@0x/utils";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";

export function onNFTReceived() {
  it("Seller can fill buy order without approving ERC721", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: NFTOrder.STRUCT_ABI,
        },
        {
          name: "signature",
          type: "tuple",
          components: SIGNATURE_ABI,
        },
        { name: "unwrapNativeToken", type: "bool" },
        { name: "merkleProof", type: "bytes32[]" },
      ],
      [
        {
          name: "fee",
          type: "tuple",
          internalType: "Fee",
          components: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ]
    );
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        buyOrder.nftTokenId,
        dataEncoder.encode({
          order: {
            ...buyOrder,
            expiry: new ZeroExBN(buyOrder.expiry.toString()),
            nonce: new ZeroExBN(buyOrder.nonce.toString()),
            erc20TokenAmount: new ZeroExBN(
              buyOrder.erc20TokenAmount.toString()
            ),
            nftTokenId: new ZeroExBN(buyOrder.nftTokenId.toString()),
            nftTokenIds: buyOrder.nftTokenIds.map(
              (tokenId) => new ZeroExBN(tokenId.toString())
            ),
            nftTokenAmount: new ZeroExBN(buyOrder.nftTokenAmount.toString()),
          },
          signature: buyOrderSignature,
          unwrapNativeToken: false,
          merkleProof: [],
        })
      )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.bob.address, this.shoyuEx.address, buyOrder.nftTokenId)
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.shoyuEx.address, this.alice.address, buyOrder.nftTokenId)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        buyOrder.direction,
        buyOrder.maker,
        this.erc721.address,
        buyOrder.nonce,
        buyOrder.erc20Token,
        buyOrder.erc20TokenAmount,
        buyOrder.nftToken,
        buyOrder.nftTokenId,
        buyOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Seller can fill buy order without approving ERC1155", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: NFTOrder.STRUCT_ABI,
        },
        {
          name: "signature",
          type: "tuple",
          components: SIGNATURE_ABI,
        },
        { name: "unwrapNativeToken", type: "bool" },
        { name: "merkleProof", type: "bytes32[]" },
      ],
      [
        {
          name: "fee",
          type: "tuple",
          internalType: "Fee",
          components: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ]
    );
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "420", "1");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT */
    await expect(
      (
        await this.erc1155.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        buyOrder.nftTokenId,
        buyOrder.nftTokenAmount,
        dataEncoder.encode({
          order: {
            ...buyOrder,
            expiry: new ZeroExBN(buyOrder.expiry.toString()),
            nonce: new ZeroExBN(buyOrder.nonce.toString()),
            erc20TokenAmount: new ZeroExBN(
              buyOrder.erc20TokenAmount.toString()
            ),
            nftTokenId: new ZeroExBN(buyOrder.nftTokenId.toString()),
            nftTokenIds: buyOrder.nftTokenIds.map(
              (tokenId) => new ZeroExBN(tokenId.toString())
            ),
            nftTokenAmount: new ZeroExBN(buyOrder.nftTokenAmount.toString()),
          },
          signature: buyOrderSignature,
          unwrapNativeToken: false,
          merkleProof: [],
        })
      )
    )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.bob.address,
        this.bob.address,
        this.shoyuEx.address,
        buyOrder.nftTokenId,
        buyOrder.nftTokenAmount
      )
      .to.emit(this.erc1155, "TransferSingle")
      .withArgs(
        this.shoyuEx.address,
        this.shoyuEx.address,
        this.alice.address,
        buyOrder.nftTokenId,
        buyOrder.nftTokenAmount
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        buyOrder.direction,
        buyOrder.maker,
        this.erc1155.address,
        buyOrder.nonce,
        buyOrder.erc20Token,
        buyOrder.erc20TokenAmount,
        buyOrder.nftToken,
        buyOrder.nftTokenId,
        buyOrder.nftTokenAmount
      );

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(1);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(0);
  });

  it("Reverts if order cannot be filled", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: NFTOrder.STRUCT_ABI,
        },
        {
          name: "signature",
          type: "tuple",
          components: SIGNATURE_ABI,
        },
        { name: "unwrapNativeToken", type: "bool" },
        { name: "merkleProof", type: "bytes32[]" },
      ],
      [
        {
          name: "fee",
          type: "tuple",
          internalType: "Fee",
          components: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
      ]
    );
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    const buyOrder = new NFTOrder({
      chainId: 31337,
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: BigNumber.from(420),
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        buyOrder.nftTokenId,
        dataEncoder.encode({
          order: {
            ...buyOrder,
            expiry: new ZeroExBN(buyOrder.expiry.toString()),
            nonce: new ZeroExBN(buyOrder.nonce.toString()),
            erc20TokenAmount: new ZeroExBN(
              buyOrder.erc20TokenAmount.toString()
            ),
            nftTokenId: new ZeroExBN(buyOrder.nftTokenId.toString()),
            nftTokenIds: buyOrder.nftTokenIds.map(
              (tokenId) => new ZeroExBN(tokenId.toString())
            ),
            nftTokenAmount: new ZeroExBN(buyOrder.nftTokenAmount.toString()),
          },
          signature: buyOrderSignature,
          unwrapNativeToken: false,
          merkleProof: [],
        })
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });
}
