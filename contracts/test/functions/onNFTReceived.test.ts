import { BigNumber } from "@ethersproject/bignumber";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { AbiEncoder } from "@0x/utils";
import { SIGNATURE_ABI } from "@0x/protocol-utils";
import { BigNumber as ZeroExBN } from "@0x/utils";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import { MAX_TOKENID_MERKLE_ROOT } from "../../utils/constants";
import TestNFTOrder from "../utils/TestBuyOrder";

export function onNFTReceived() {
  it("Seller can fill buy order without approving ERC721", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
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
        this.bob.address,
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
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc1155.mint(this.bob.address, "333", "1");

    /* alice creates a buy order for bob's ERC7221 */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      maker: this.alice.address,
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
        this.bob.address,
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

  it("Seller can fill property-based buy order without approving ERC721", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "1");

    /* alice creates a buy order for bob's ERC7221 */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenIds: [1, 2, 3],
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT
       with tokenId = 1, and merkleProof
    */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        1,
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
          merkleProof: buyOrder.getMerkleProof(BigNumber.from(1)),
        })
      )
    )
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.bob.address, this.shoyuEx.address, buyOrder.nftTokenAmount)
      .to.emit(this.erc721, "Transfer")
      .withArgs(
        this.shoyuEx.address,
        this.alice.address,
        buyOrder.nftTokenAmount
      )
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        buyOrder.direction,
        buyOrder.maker,
        this.bob.address,
        buyOrder.nonce,
        buyOrder.erc20Token,
        buyOrder.erc20TokenAmount,
        buyOrder.nftToken,
        1,
        buyOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Seller can fill collection-wide buy order without approving ERC721", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "1");

    /* alice creates a buy order for bob's ERC7221 */
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenIdsMerkleRoot: MAX_TOKENID_MERKLE_ROOT,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT
       with tokenId = 1, and merkleProof
    */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        1,
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
      .withArgs(this.bob.address, this.shoyuEx.address, 1)
      .to.emit(this.erc721, "Transfer")
      .withArgs(this.shoyuEx.address, this.alice.address, 1)
      .to.emit(this.shoyuEx, "NFTOrderFilled")
      .withArgs(
        buyOrder.direction,
        buyOrder.maker,
        this.bob.address,
        buyOrder.nonce,
        buyOrder.erc20Token,
        buyOrder.erc20TokenAmount,
        buyOrder.nftToken,
        1,
        buyOrder.nftTokenAmount
      );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Reverts if invalid order signature", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
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

  it("Reverts if invalid tokenId is sent", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "5");

    /* alice creates a buy order for bob's ERC7221 */
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 2,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        5,
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

  it("Reverts if invalid merkleProof is sent", async function () {
    const dataEncoder = AbiEncoder.create(
      [
        {
          name: "order",
          type: "tuple",
          components: TestNFTOrder.STRUCT_ABI,
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
    await this.erc721.mint(this.bob.address, "5");

    /* alice creates a buy order for bob's ERC7221 */
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: 5000,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenIds: [2, 3, 5],
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills sell order by calling `safeTransferFrom` on NFT */
    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        5,
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
          merkleProof: buyOrder.getMerkleProof(BigNumber.from(6)),
        })
      )
    ).to.be.reverted;

    await expect(
      (
        await this.erc721.connect(this.bob)
      )["safeTransferFrom(address,address,uint256,bytes)"](
        this.bob.address,
        this.shoyuEx.address,
        5,
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
