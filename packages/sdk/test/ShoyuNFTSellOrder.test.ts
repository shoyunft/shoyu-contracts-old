import { BigNumber } from "@ethersproject/bignumber";

import { NATIVE_TOKEN_ADDRESS } from "../src/constants";
import { ShoyuNFTSellOrder } from "../src/entities";
import { ChainId, NFTStandard } from "../src/enums";
import { TEST_ADDRESS } from "./utils/constants";

describe("ShoyuNFTSellOrder", () => {
  it("Create sell order", () => {
    const sellOrderERC1155 = new ShoyuNFTSellOrder({
      chainId: ChainId.HARDHAT,
      maker: TEST_ADDRESS.alice,
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
      nonce: BigNumber.from(Date.now()),
      erc20Token: NATIVE_TOKEN_ADDRESS,
      erc20SellAmount: 500,
      nftStandard: NFTStandard.ERC1155,
      nftToken: TEST_ADDRESS.erc1155,
      nftTokenId: 42069,
      nftTokenAmount: BigNumber.from(2),
    });

    console.log(sellOrderERC1155);
  });
});
