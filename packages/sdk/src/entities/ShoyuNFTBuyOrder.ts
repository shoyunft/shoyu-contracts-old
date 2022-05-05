import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { ShoyuNFTOrder } from "./ShoyuNFTOrder";
import {
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
  WETH9_ADDRESS,
} from "../constants";
import { ShoyuError, TradeDirection } from "../enums";
import { Fee, ShoyuNFTBuyOrderProps } from "../interfaces";

export class ShoyuNFTBuyOrder extends ShoyuNFTOrder {
  public wethBuyAmount: BigNumber;

  public constructor(props: ShoyuNFTBuyOrderProps) {
    // wethBuyAmount = erc20TokenAmount + royaltyAmount
    const erc20TokenAmount = BigNumber.from(props.wethBuyAmount).sub(
      props.royaltyFee?.amount ?? 0
    );

    const fees: Fee[] = [
      {
        recipient: PROTOCOL_FEE_RECIPIENT[props.chainId],
        amount: BigNumber.from(
          PROTOCOL_FEE.multiply(
            props.wethBuyAmount.toString()
          ).quotient.toString()
        ),
      },
    ];

    if (props.royaltyFee) {
      fees.push({
        recipient: props.royaltyFee.recipient,
        amount: BigNumber.from(props.royaltyFee.amount),
      });
    }

    super({
      direction: TradeDirection.BuyNFT,
      maker: props.maker,
      expiry: BigNumber.from(props.expiry),
      nonce: BigNumber.from(props.nonce),
      erc20Token: WETH9_ADDRESS[props.chainId],
      erc20TokenAmount: erc20TokenAmount,
      nftStandard: props.nftStandard,
      nftToken: props.nftToken,
      nftTokenId: BigNumber.from(props.nftTokenId || 0),
      nftTokenIds:
        props.nftTokenIds?.map((nftTokenId) => BigNumber.from(nftTokenId)) ??
        [],
      nftTokenAmount: BigNumber.from(props.nftTokenAmount || 1),
      chainId: props.chainId,
      verifyingContract:
        props.verifyingContract || SHOYU_EXCHANGE_ADDRESS[props.chainId],
      taker: props.taker || AddressZero,
      fees,
    });

    this.wethBuyAmount = BigNumber.from(props.wethBuyAmount);

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
