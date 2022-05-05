import { ShoyuNFTBuyOrder } from "../src/entities";
import { ChainId, NFTStandard, ShoyuError, TradeDirection } from "../src/enums";
import { TEST_ADDRESS } from "./utils/constants";

describe("ShoyuNFTBuyOrder", () => {
  it("Create valid buy order", () => {
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

    const totalAmount = buyOrderERC1155
      .getTotalERC20Amount(buyOrderERC1155.nftTokenAmount)
      .toString();

    expect(totalAmount).toBe(
      buyOrderERC1155.erc20TokenAmount
        .add(buyOrderERC1155.fees[0].amount)
        .toString()
    );

    const buyOrderERC721 = new ShoyuNFTBuyOrder({
      chainId: ChainId.ETHEREUM,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: TEST_ADDRESS.erc721,
      nftTokenId: 4,
    });

    expect(buyOrderERC721.isValid()).toBe(true);

    const propertyBuyOrderERC721 = new ShoyuNFTBuyOrder({
      chainId: ChainId.ETHEREUM,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC721,
      nftToken: TEST_ADDRESS.erc721,
      nftTokenIds: [0, 1, 2, 3],
    });

    expect(propertyBuyOrderERC721.isValid()).toBe(true);
  });

  it("Reverts if `direction` is `SellNFT`", () => {
    const sellOrderERC1155 = new ShoyuNFTBuyOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      wethBuyAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 4,
      nftTokenAmount: 2,
    });

    sellOrderERC1155.direction = TradeDirection.SellNFT;

    expect(() => sellOrderERC1155.validate()).toThrow(
      ShoyuError.INVALID_TRADE_DIRECTION
    );
  });
});
