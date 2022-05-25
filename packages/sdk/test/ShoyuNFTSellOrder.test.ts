import { parseUnits } from "@ethersproject/units";

import { ShoyuNFTSellOrder } from "../src/entities";
import { ChainId, NFTStandard, ShoyuError, TradeDirection } from "../src/enums";
import { randomAddress } from "./utils/address_utils";
import { TEST_ADDRESS } from "./utils/constants";

describe("ShoyuNFTSellOrder", () => {
  it("Create valid sell order", () => {
    const sellOrderERC1155 = new ShoyuNFTSellOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      ethSellAmount: parseUnits("1").toString(),
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 3,
      nftTokenAmount: 2,
    });

    expect(sellOrderERC1155.isValid()).toBe(true);

    const sellOrderERC721 = new ShoyuNFTSellOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      taker: TEST_ADDRESS.bob,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      ethSellAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: TEST_ADDRESS.erc721,
      nftTokenId: 55,
    });

    expect(sellOrderERC721.isValid()).toBe(true);
  });

  it("Reverts if `direction` is `BuyNFT`", () => {
    const sellOrderERC1155 = new ShoyuNFTSellOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      ethSellAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 4,
      nftTokenAmount: 2,
    });

    sellOrderERC1155.direction = TradeDirection.BuyNFT;

    expect(() => sellOrderERC1155.validate()).toThrow(
      ShoyuError.INVALID_TRADE_DIRECTION
    );
  });

  it("Reverts if `erc20Token` is not native token", () => {
    const sellOrderERC1155 = new ShoyuNFTSellOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      ethSellAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 3,
      nftTokenAmount: 2,
    });

    sellOrderERC1155.erc20Token = randomAddress();

    expect(() => sellOrderERC1155.validate()).toThrow(
      ShoyuError.NATIVE_TOKEN_ONLY
    );
  });
});
