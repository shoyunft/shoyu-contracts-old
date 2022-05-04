import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, HashZero } from "@ethersproject/constants";

import { ShoyuNFTOrder } from "./ShoyuNFTOrder";
import {
  MAX_TOKENID_MERKLE_ROOT,
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
  WETH9_ADDRESS,
} from "../constants";
import { TradeDirection } from "../enums";
import { Fee, ShoyuNFTBuyOrderProps } from "../interfaces";

export class ShoyuNFTBuyOrder extends ShoyuNFTOrder {
  public constructor(props: ShoyuNFTBuyOrderProps) {
    // erc20BuyAmount = erc20TokenAmount + royaltyAmount
    const erc20TokenAmount = BigNumber.from(props.erc20BuyAmount).sub(
      BigNumber.from(props.royaltyFee?.amount ?? 0)
    );

    const fees: Fee[] = [
      {
        recipient: PROTOCOL_FEE_RECIPIENT[props.chainId],
        amount: BigNumber.from(
          PROTOCOL_FEE.multiply(props.erc20BuyAmount.toString()).quotient
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

    if (this.direction !== TradeDirection.BuyNFT) {
      throw new Error("WRONG_TRADE_DIRECTION");
    }
    if (this.erc20Token !== WETH9_ADDRESS[this.chainId]) {
      throw new Error("WRAPPED_NATIVE_TOKEN_ONLY");
    }
    if (
      this.nftTokenIds?.length > 0 &&
      (this.nftTokenIdsMerkleRoot === HashZero ||
        this.nftTokenIdsMerkleRoot === MAX_TOKENID_MERKLE_ROOT)
    ) {
      throw new Error("INVALID_MERKLE_ROOT");
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
