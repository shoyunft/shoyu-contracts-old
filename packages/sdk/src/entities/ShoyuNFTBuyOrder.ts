import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { ShoyuNFTOrder } from "./ShoyuNFTOrder";
import {
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
  WETH9_ADDRESS,
} from "../constants";
import { ChainId, NFTStandard, ShoyuError, TradeDirection } from "../enums";
import { Fee } from "../interfaces";

export interface NewShoyuNFTBuyOrder {
  chainId: ChainId;
  verifyingContract?: string;
  maker: string;
  expiry: BigNumberish;
  nonce: BigNumberish;
  wethBuyAmount: BigNumberish;
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId?: BigNumberish;
  nftTokenIds?: BigNumberish[];
  nftTokenAmount?: BigNumberish;
  royaltyFee?: { amount: BigNumberish; recipient: string };
  taker?: string;
}

export class ShoyuNFTBuyOrder extends ShoyuNFTOrder {
  public wethBuyAmount: BigNumber;

  public constructor({
    chainId,
    maker,
    expiry,
    nonce,
    wethBuyAmount,
    nftStandard,
    nftToken,
    nftTokenId = 0,
    nftTokenIds = [],
    nftTokenAmount = 1,
    royaltyFee = null,
    taker = AddressZero,
    verifyingContract = SHOYU_EXCHANGE_ADDRESS[chainId],
  }: NewShoyuNFTBuyOrder) {
    // wethBuyAmount = erc20TokenAmount + royaltyAmount
    const erc20TokenAmount = BigNumber.from(wethBuyAmount).sub(
      royaltyFee?.amount ?? 0
    );

    const fees: Fee[] = [
      {
        recipient: PROTOCOL_FEE_RECIPIENT[chainId],
        amount: BigNumber.from(
          PROTOCOL_FEE.multiply(wethBuyAmount.toString()).quotient.toString()
        ),
      },
    ];

    if (royaltyFee) {
      fees.push({
        recipient: royaltyFee.recipient,
        amount: BigNumber.from(royaltyFee.amount),
      });
    }

    super({
      chainId,
      verifyingContract,
      maker,
      taker,
      fees,
      nftStandard,
      nftToken,
      erc20TokenAmount,
      direction: TradeDirection.BuyNFT,
      expiry: BigNumber.from(expiry),
      nonce: BigNumber.from(nonce),
      erc20Token: WETH9_ADDRESS[chainId],
      nftTokenId: BigNumber.from(nftTokenId),
      nftTokenIds: nftTokenIds.map((nftTokenId) => BigNumber.from(nftTokenId)),
      nftTokenAmount: BigNumber.from(nftTokenAmount),
    });

    this.wethBuyAmount = BigNumber.from(wethBuyAmount);

    this.validate();
  }

  public validate() {
    super.validate();

    if (this.direction !== TradeDirection.BuyNFT) {
      throw new Error(ShoyuError.INVALID_TRADE_DIRECTION);
    }
    if (this.erc20Token !== WETH9_ADDRESS[this.chainId]) {
      throw new Error(ShoyuError.WRAPPED_NATIVE_TOKEN_ONLY);
    }
  }

  public isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch (e) {
      return false;
    }
  }
}
