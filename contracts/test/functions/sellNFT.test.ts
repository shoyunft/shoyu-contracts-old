import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { MaxUint256 } from "@ethersproject/constants";

import { NFTStandard, TradeDirection } from "../../utils/nft_orders";
import TestNFTOrder from "../utils/TestBuyOrder";

export function sellNFT() {
  it("Seller can fill ERC721 buy order", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
      fees: [
        {
          recipient: this.deployer.address,
          amount: offerAmount.div(50), // * 0.02
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

  it("Seller can fill ERC1155 buy order", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "2");

    /* alice creates a buy order for bob's ERC1155 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      nftTokenAmount: 2,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          buyOrder.nftTokenId, // tokenId
          buyOrder.nftTokenAmount, // order amount
          false, // unwrap token
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc1155, "TransferSingle")
        .withArgs(
          this.shoyuEx.address,
          this.bob.address,
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
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob],
      [-buyOrder.erc20TokenAmount, buyOrder.erc20TokenAmount]
    );

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(2);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(0);
  });

  it("Seller can partially fill ERC1155 buy order", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, "333", "2");

    /* alice creates a buy order for 4 editions of ERC1155 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: this.erc1155.address,
      nftTokenId: 333,
      nftTokenAmount: 4,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob 1/4 of buy order */
    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

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
        .to.emit(this.erc1155, "TransferSingle")
        .withArgs(
          this.shoyuEx.address,
          this.bob.address,
          this.alice.address,
          buyOrder.nftTokenId,
          1
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
          1
        )
    ).to.changeTokenBalances(
      this.weth,
      [this.alice, this.bob],
      [-buyOrder.erc20TokenAmount.div(4), buyOrder.erc20TokenAmount.div(4)]
    );

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(1);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(1);
  });

  it("Buyer creates an offer for multiple tokenIds and seller can fill the order with valid proof", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 of tokenIds 1, 2, or 333 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenIds: [1, 2, 333],
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with tokenId 333 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "333");

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          "333", // tokenId
          1, // order amount
          false, // unwrap token
          buyOrder.getMerkleProof(BigNumber.from("333")) // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, "333")
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.bob.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          "333", // tokenId
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates offer for any tokenId of collection */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      maker: this.alice.address,
      nftTokenIdsMerkleRoot: MaxUint256._hex,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order with tokenId 333 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "333");

    await expect(() =>
      expect(
        this.shoyuEx.connect(this.bob).sellNFT(
          buyOrder, // LibNFTOrder
          buyOrderSignature, // LibSignature
          "333", // tokenId
          1, // order amount
          false, // unwrap token
          [] // tokenIdsMerkleProof
        )
      )
        .to.emit(this.erc721, "Transfer")
        .withArgs(this.bob.address, this.alice.address, "333")
        .to.emit(this.shoyuEx, "NFTOrderFilled")
        .withArgs(
          buyOrder.direction,
          buyOrder.maker,
          this.bob.address,
          buyOrder.nonce,
          buyOrder.erc20Token,
          buyOrder.erc20TokenAmount,
          buyOrder.nftToken,
          "333", // tokenId
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
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 of tokenIds 1, 2, or 3 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenIds: [1, 2, 3],
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob tries to fill order with tokenId 333 */
    await this.erc721.connect(this.bob).approve(this.shoyuEx.address, "333");

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        "333", // tokenId
        1, // order amount
        false, // unwrap token
        buyOrder.getMerkleProof(BigNumber.from("333")) // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });

  it("Reverts if seller tries to fill order with nftTokenAmount > order.remainingAmount", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, 5, 10);

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
      nftTokenId: 5,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        2, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(0);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(10);
  });

  it("Reverts if taker is different than the order specifies", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc1155.mint(this.bob.address, 5, 10);

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
      nftTokenId: 5,
      nftTokenAmount: 2,
      maker: this.alice.address,
      taker: this.deployer.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    await this.erc1155
      .connect(this.bob)
      .setApprovalForAll(this.shoyuEx.address, true);

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        2, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(
      await this.erc1155.balanceOf(this.alice.address, buyOrder.nftTokenId)
    ).to.eq(0);
    expect(
      await this.erc1155.balanceOf(this.bob.address, buyOrder.nftTokenId)
    ).to.eq(10);
  });

  it("Reverts if order has already been filled", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
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

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(1);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(0);
  });

  it("Reverts if `order.erc20Token` is not WETH", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 using ERC20 */
    const offerAmount = BigNumber.from("5000");
    await this.erc20
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.erc20.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        buyOrder.nftTokenAmount, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });

  it("Reverts if `order.direction` is not BuyNFT", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.SellNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills tries to fill order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });

  it("Reverts if fee recipient is set to exchange proxy", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
      fees: [
        {
          recipient: this.shoyuEx.address,
          amount: offerAmount.div(50), // * 0.02
        },
      ],
    });

    const buyOrderSignature = await buyOrder.sign(this.alice);

    /* bob fills buy order */
    await this.erc721
      .connect(this.bob)
      .approve(this.shoyuEx.address, buyOrder.nftTokenId);

    await expect(
      this.shoyuEx.connect(this.bob).sellNFT(
        buyOrder, // LibNFTOrder
        buyOrderSignature, // LibSignature
        buyOrder.nftTokenId, // tokenId
        1, // order amount
        false, // unwrap token
        [] // tokenIdsMerkleProof
      )
    ).to.be.reverted;

    expect(await this.erc721.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.erc721.balanceOf(this.bob.address)).to.eq(1);
  });

  it("Succeeds with 0 feeAmount", async function () {
    await this.weth.connect(this.alice).deposit({ value: "50000" });
    await this.erc721.mint(this.bob.address, "333");

    /* alice creates a buy order for bob's ERC7221 */
    const offerAmount = BigNumber.from("5000");
    await this.weth
      .connect(this.alice)
      .approve(this.shoyuEx.address, MaxUint256);
    const buyOrder = new TestNFTOrder({
      verifyingContract: this.shoyuEx.address,
      direction: TradeDirection.BuyNFT,
      erc20Token: this.weth.address,
      erc20TokenAmount: offerAmount,
      nftStandard: NFTStandard.ERC721,
      nftToken: this.erc721.address,
      nftTokenId: 333,
      maker: this.alice.address,
      fees: [
        {
          recipient: this.deployer.address,
          amount: BigNumber.from(0),
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
}
