import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";

import { NFTOrder, NFTStandard, TradeDirection } from "../../utils/nft_orders";

import { expect } from "chai";

export function sellNFT() {
  it("Seller can fill ERC721 buy order", async function () {
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

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          1, // order amount
          false, // unwrap token
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, buyOrder.nftTokenId)
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
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob],
      [-buyOrder.erc20TokenAmount, buyOrder.erc20TokenAmount]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Seller can fill ERC721 buy order with 2% fee", async function () {
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
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          1, // order amount
          false, // unwrap token
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, buyOrder.nftTokenId)
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
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob, this.deployer],
      [
        -buyOrder.erc20TokenAmount.add(buyOrder.fees[0].amount),
        buyOrder.erc20TokenAmount,
        buyOrder.fees[0].amount,
      ]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Seller can fill ERC721 buy order with 2% fee and unwrap to ETH", async function () {
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
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
          feeData: "0x",
        },
      ],
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order and unwraps to ETH */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(async () =>
      expect(
        await this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          1, // order amount
          true, // unwrap token
          [] // tokenIdMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, buyOrder.nftTokenId)
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
        )
        .to.changeEtherBalance(this.bob, buyOrder.erc20TokenAmount)
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.deployer],
      [
        -buyOrder.erc20TokenAmount.add(buyOrder.fees[0].amount),
        buyOrder.fees[0].amount,
      ]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Buyer creates an offer for multiple tokenIds and seller can fill the order with valid proof", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 of tokenIds 1, 2, or 420 */
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
      nftTokenIds: [BigNumber.from(1), BigNumber.from(2), BigNumber.from(420)],
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with tokenId 420 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "420");

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          "420", // tokenId
          1, // order amount
          false, // unwrap token
          buyOrder.getMerkleProof(BigNumber.from("420")) // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, "420")
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.bob.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          "420", // tokenId
          buyOrder.nftTokenAmount
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob],
      [-buyOrder.erc20TokenAmount, buyOrder.erc20TokenAmount]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Buyer creates a collection-wide offer and seller can fill the order with any tokenId", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates offer for any tokenId of collection */
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
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      nftTokenIdsMerkleRoot: MaxUint256._hex,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with tokenId 420 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "420");

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          "420", // tokenId
          1, // order amount
          false, // unwrap token
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, "420")
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.bob.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          "420", // tokenId
          buyOrder.nftTokenAmount
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob],
      [-buyOrder.erc20TokenAmount, buyOrder.erc20TokenAmount]
    );

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Reverts on invalid merkle proof", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "420");

    /* alice creates a buy order for bob's ERC7221 of tokenIds 1, 2, or 3 */
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
      nftTokenIds: [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)],
      nftTokenAmount: BigNumber.from(1),
      maker: this.alice.address,
      taker: AddressZero,
      nonce: BigNumber.from(Date.now()),
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob tries to fill order with tokenId 420 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "420");

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        "420", // tokenId
        1, // order amount
        false, // unwrap token
        buyOrder.getMerkleProof(BigNumber.from("420")) // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });
}
