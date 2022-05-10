import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { ShoyuNFTOrder } from "./ShoyuNFTOrder";
import {
  NATIVE_TOKEN_ADDRESS,
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
} from "../constants";
import { ChainId, NFTStandard, ShoyuError, TradeDirection } from "../enums";
import { Fee } from "../interfaces";

export interface NewShoyuNFTSellOrder {
  chainId: ChainId;
  verifyingContract?: string;
  maker: string;
  expiry: BigNumberish;
  nonce: BigNumberish;
  ethSellAmount: BigNumberish;
  nftStandard: NFTStandard;
  nftToken: string;
  nftTokenId: BigNumberish;
  nftTokenAmount?: BigNumberish;
  royaltyFee?: { amount: BigNumberish; recipient: string };
  taker?: string;
}

export class ShoyuNFTSellOrder extends ShoyuNFTOrder {
  public ethSellAmount: BigNumber;

  public constructor({
    chainId,
    maker,
    expiry,
    nonce,
    ethSellAmount,
    nftStandard,
    nftToken,
    nftTokenId,
    verifyingContract = SHOYU_EXCHANGE_ADDRESS[chainId],
    nftTokenAmount = 1,
    royaltyFee = null,
    taker = AddressZero,
  }: NewShoyuNFTSellOrder) {
    // ethSellAmount = erc20TokenAmount + royaltyAmount
    const erc20TokenAmount = BigNumber.from(ethSellAmount).sub(
      BigNumber.from(royaltyFee?.amount ?? 0)
    );

    const fees: Fee[] = [
      {
        recipient: PROTOCOL_FEE_RECIPIENT[chainId],
        amount: BigNumber.from(
          PROTOCOL_FEE.multiply(ethSellAmount.toString()).quotient.toString()
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
      direction: TradeDirection.SellNFT,
      expiry: BigNumber.from(expiry),
      nonce: BigNumber.from(nonce),
      erc20Token: NATIVE_TOKEN_ADDRESS,
      nftTokenId: BigNumber.from(nftTokenId),
      nftTokenIds: [],
      nftTokenAmount: BigNumber.from(nftTokenAmount),
    });

    this.ethSellAmount = BigNumber.from(ethSellAmount);

    this.validate();
  }

  public validate() {
    super.validate();

    if (this.direction !== TradeDirection.SellNFT) {
      throw new Error(ShoyuError.INVALID_TRADE_DIRECTION);
    }
    if (this.erc20Token !== NATIVE_TOKEN_ADDRESS) {
      throw new Error(ShoyuError.NATIVE_TOKEN_ONLY);
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
