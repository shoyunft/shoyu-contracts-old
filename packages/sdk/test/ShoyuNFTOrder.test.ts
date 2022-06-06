import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Wallet } from "@ethersproject/wallet";
import { Percent } from "@sushiswap/core-sdk";

import { MAX_TOKENID_MERKLE_ROOT, PROTOCOL_FEE } from "../src/constants";
import { ShoyuNFTBuyOrder } from "../src/entities";
import { ChainId, NFTStandard, ShoyuError } from "../src/enums";
import { TEST_ADDRESS } from "./utils/constants";

describe("ShoyuNFTOrder", () => {
  it("Protocol fee is calculated properly", () => {
    const buyOrderERC1155 = new ShoyuNFTBuyOrder({
      chainId: ChainId.ETHEREUM,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 6642120,
      nftTokenAmount: 2,
    });

    expect(buyOrderERC1155.isValid()).toBe(true);

    expect(buyOrderERC1155.fees[0].amount.toString()).toBe(
      PROTOCOL_FEE.multiply(
        buyOrderERC1155.wethBuyAmount.toString()
      ).quotient.toString()
    );

    const totalAmount = buyOrderERC1155
      .getTotalERC20Amount(buyOrderERC1155.nftTokenAmount)
      .toString();

    expect(totalAmount).toBe(
      buyOrderERC1155.erc20TokenAmount
        .add(buyOrderERC1155.fees[0].amount)
        .toString()
    );
  });

  it("Royalty is calculated properly", () => {
    const royaltyPercent = new Percent(5, 100);
    const wethBuyAmount = 500;
    const buyOrderWithRoyalties = new ShoyuNFTBuyOrder({
      chainId: ChainId.ETHEREUM,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      wethBuyAmount: wethBuyAmount,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 6642120,
      nftTokenAmount: 2,
      royaltyFee: {
        amount: royaltyPercent.multiply(wethBuyAmount).quotient.toString(),
        recipient: TEST_ADDRESS.bob,
      },
    });

    const totalAmountFull = buyOrderWithRoyalties
      .getTotalERC20Amount(buyOrderWithRoyalties.nftTokenAmount)
      .toString();

    expect(totalAmountFull).toBe(
      buyOrderWithRoyalties.erc20TokenAmount
        .add(
          buyOrderWithRoyalties.fees.reduce(
            (prev, cur) => (prev = prev.add(cur.amount)),
            BigNumber.from(0)
          )
        )
        .toString()
    );

    const partialFillAmount = 1;
    const totalAmountPartial = buyOrderWithRoyalties
      .getTotalERC20Amount(partialFillAmount)
      .toString();

    expect(totalAmountPartial).toBe(
      buyOrderWithRoyalties.erc20TokenAmount
        .mul(partialFillAmount)
        .div(buyOrderWithRoyalties.nftTokenAmount)
        .add(
          buyOrderWithRoyalties.fees
            .reduce(
              (prev, cur) => (prev = prev.add(cur.amount)),
              BigNumber.from(0)
            )
            .mul(partialFillAmount)
            .div(buyOrderWithRoyalties.nftTokenAmount)
        )
        .toString()
    );
  });

  it("willExpire returns `true` on expired test", () => {
    const order = new ShoyuNFTBuyOrder({
      chainId: ChainId.ETHEREUM,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) - 1,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 42069,
      nftTokenAmount: 2,
    });
    expect(order.willExpire(0)).toBe(true);
  });

  it("Throws error on invalid `verifyingContract`", () => {
    expect(
      () =>
        new ShoyuNFTBuyOrder({
          chainId: ChainId.ETHEREUM,
          maker: TEST_ADDRESS.alice,
          expiry: Math.floor(Date.now() / 1000) + 5,
          nonce: Date.now(),
          wethBuyAmount: 500,
          nftStandard: NFTStandard.ERC1155,
          nftToken: TEST_ADDRESS.erc1155,
          nftTokenId: 42069,
          nftTokenAmount: 2,
          verifyingContract: AddressZero,
        })
    ).toThrow(ShoyuError.INVALID_VERIFYING_CONTRACT);
  });

  it("Throws error on invalid `nftTokenAmount`", () => {
    expect(
      () =>
        new ShoyuNFTBuyOrder({
          chainId: ChainId.ETHEREUM,
          maker: TEST_ADDRESS.alice,
          expiry: Math.floor(Date.now() / 1000) + 5,
          nonce: Date.now(),
          wethBuyAmount: 500,
          nftStandard: NFTStandard.ERC721,
          nftToken: TEST_ADDRESS.erc721,
          nftTokenId: 42069,
          nftTokenAmount: 2,
        })
    ).toThrow(ShoyuError.INVALID_NFT_TOKEN_AMOUNT);
  });

  it("Throws error on invalid `chainId`", () => {
    expect(
      () =>
        new ShoyuNFTBuyOrder({
          chainId: 12,
          maker: TEST_ADDRESS.alice,
          expiry: Math.floor(Date.now() / 1000) + 5,
          nonce: Date.now(),
          wethBuyAmount: 500,
          nftStandard: NFTStandard.ERC721,
          nftToken: TEST_ADDRESS.erc721,
          nftTokenId: 42069,
          nftTokenAmount: 1,
        })
    ).toThrow(ShoyuError.INVALID_CHAINID);
  });

  it("Throws error on missing protocol fee", () => {
    expect(() => {
      const order = new ShoyuNFTBuyOrder({
        chainId: 1,
        maker: TEST_ADDRESS.alice,
        expiry: Math.floor(Date.now() / 1000) + 5,
        nonce: Date.now(),
        wethBuyAmount: 500,
        nftStandard: NFTStandard.ERC721,
        nftToken: TEST_ADDRESS.erc721,
        nftTokenId: 42069,
        nftTokenAmount: 1,
      });

      order.fees = [];

      order.validate();
    }).toThrow(ShoyuError.INVALID_PROTOCOL_FEE);

    expect(() => {
      const order = new ShoyuNFTBuyOrder({
        chainId: 1,
        maker: TEST_ADDRESS.alice,
        expiry: Math.floor(Date.now() / 1000) + 5,
        nonce: Date.now(),
        wethBuyAmount: 500,
        nftStandard: NFTStandard.ERC721,
        nftToken: TEST_ADDRESS.erc721,
        nftTokenId: 42069,
        nftTokenAmount: 1,
      });

      order.fees[0].amount = BigNumber.from(4);

      order.validate();
    }).toThrow(ShoyuError.INVALID_PROTOCOL_FEE);
  });

  it("Throws error on invalid `nftTokenId`", () => {
    expect(
      () =>
        new ShoyuNFTBuyOrder({
          chainId: 1,
          maker: TEST_ADDRESS.alice,
          expiry: Math.floor(Date.now() / 1000) + 5,
          nonce: Date.now(),
          wethBuyAmount: 500,
          nftStandard: NFTStandard.ERC721,
          nftToken: TEST_ADDRESS.erc721,
          nftTokenId: 42069,
          nftTokenIds: [5, 4, 3, 2],
          nftTokenAmount: 1,
        })
    ).toThrow(ShoyuError.INVALID_NFT_TOKENID);
  });

  it("Throws error on invalid merkle proof", () => {
    expect(() => {
      const order = new ShoyuNFTBuyOrder({
        chainId: 1,
        maker: TEST_ADDRESS.alice,
        expiry: Math.floor(Date.now() / 1000) + 5,
        nonce: Date.now(),
        wethBuyAmount: 500,
        nftStandard: NFTStandard.ERC721,
        nftToken: TEST_ADDRESS.erc721,
        nftTokenIds: [1, 2, 420],
        nftTokenAmount: 1,
      });

      order.nftTokenIdsMerkleRoot = "0x1234";

      order.validate();
    }).toThrow(ShoyuError.INVALID_MERKLE_ROOT);

    expect(() => {
      const order = new ShoyuNFTBuyOrder({
        chainId: 1,
        maker: TEST_ADDRESS.alice,
        expiry: Math.floor(Date.now() / 1000) + 5,
        nonce: Date.now(),
        wethBuyAmount: 500,
        nftStandard: NFTStandard.ERC721,
        nftToken: TEST_ADDRESS.erc721,
        nftTokenIds: [1, 2, 420],
        nftTokenAmount: 1,
      });

      order.nftTokenIdsMerkleRoot = MAX_TOKENID_MERKLE_ROOT;

      order.validate();
    }).toThrow(ShoyuError.INVALID_MERKLE_ROOT);
  });

  it("validateSignature() succeeds on valid signature", async () => {
    const wallet = await Wallet.createRandom();

    const order = new ShoyuNFTBuyOrder({
      chainId: 1,
      maker: wallet.address,
      expiry: Math.floor(Date.now() / 1000) + 5,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: TEST_ADDRESS.erc721,
      nftTokenIds: [1, 2, 420],
      nftTokenAmount: 1,
    });

    const signature = await order.sign(wallet);

    expect(order.verifySignature(signature)).toBe(true);
  });

  it("validateSignature() fails on invalid signature", async () => {
    const wallet = await Wallet.createRandom();

    const order = new ShoyuNFTBuyOrder({
      chainId: 1,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 5,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: TEST_ADDRESS.erc721,
      nftTokenIds: [1, 2, 420],
      nftTokenAmount: 1,
    });

    const signature = await order.sign(wallet);

    expect(order.verifySignature(signature)).toBe(false);
  });
});
