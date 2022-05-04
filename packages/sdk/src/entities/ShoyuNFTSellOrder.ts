import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import { ShoyuNFTOrder } from "./ShoyuNFTOrder";
import {
  NATIVE_TOKEN_ADDRESS,
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
} from "../constants";
import { TradeDirection } from "../enums";
import { Fee, ShoyuNFTSellOrderProps } from "../interfaces";

export class ShoyuNFTSellOrder extends ShoyuNFTOrder {
  public constructor(props: ShoyuNFTSellOrderProps) {
    // erc20SellAmount = erc20TokenAmount + royaltyAmount
    const erc20TokenAmount = BigNumber.from(props.erc20SellAmount).sub(
      BigNumber.from(props.royaltyFee?.amount ?? 0)
    );

    const fees: Fee[] = [
      {
        recipient: PROTOCOL_FEE_RECIPIENT[props.chainId],
        amount: BigNumber.from(
          PROTOCOL_FEE.multiply(props.erc20SellAmount.toString()).quotient
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
      direction: TradeDirection.SellNFT,
      maker: props.maker,
      expiry: BigNumber.from(props.expiry),
      nonce: BigNumber.from(props.nonce),
      erc20Token: NATIVE_TOKEN_ADDRESS,
      erc20TokenAmount: erc20TokenAmount,
      nftStandard: props.nftStandard,
      nftToken: props.nftToken,
      nftTokenId: BigNumber.from(props.nftTokenId),
      nftTokenAmount: BigNumber.from(props.nftTokenAmount),
      chainId: props.chainId,
      verifyingContract:
        props.verifyingContract || SHOYU_EXCHANGE_ADDRESS[props.chainId],
      taker: props.taker || AddressZero,
      fees,
    });

    this.validate();
  }

  public validate() {
    super.validate();

    if (this.direction !== TradeDirection.SellNFT) {
      throw new Error("WRONG_TRADE_DIRECTION");
    }
    if (this.erc20Token !== NATIVE_TOKEN_ADDRESS) {
      throw new Error("NATIVE_TOKEN_ONLY");
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
