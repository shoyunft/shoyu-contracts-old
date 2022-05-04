import { NATIVE_TOKEN_ADDRESS } from "../src/constants";
import { ShoyuNFTBuyOrder } from "../src/entities";
import { ChainId, NFTStandard } from "../src/enums";
import { TEST_ADDRESS } from "./utils/constants";

describe("ShoyuNFTBuyOrder", () => {
  it("Create buy order", () => {
    const buyOrderERC1155 = new ShoyuNFTBuyOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: Math.floor(Date.now() / 1000) + 3600,
      nonce: Date.now(),
      erc20Token: NATIVE_TOKEN_ADDRESS,
      erc20BuyAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 42069,
      nftTokenAmount: 2,
    });

    console.log(buyOrderERC1155);
  });
});
