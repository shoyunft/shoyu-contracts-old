pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../0x/features/libs/LibSignature.sol";
import "../../0x/errors/LibNFTOrdersRichErrors.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "./ShoyuNFTOrders.sol";

abstract contract ShoyuNFTSellOrders is ShoyuNFTOrders {
  constructor(
    address payable _zeroExAddress
  ) public ShoyuNFTOrders(_zeroExAddress)
  {}

  function _validateSellOrder(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    LibShoyuNFTOrder.OrderInfo memory orderInfo,
    address taker
  ) internal view {
    // Order must be selling the NFT asset.
    require(
      sellOrder.direction == LibShoyuNFTOrder.TradeDirection.SELL_NFT,
      "_validateSellOrder/WRONG_TRADE_DIRECTION"
    );
    // Sell order must be fillable with NATIVE_TOKEN
    require(
      address(sellOrder.erc20Token) == LibShoyuNFTOrder.NATIVE_TOKEN_ADDRESS,
      "_validateSellOrder/NOT_NATIVE_TOKEN"
    );
    // Taker must match the order taker, if one is specified.
    if (sellOrder.taker != address(0) && sellOrder.taker != taker) {
      LibNFTOrdersRichErrors.OnlyTakerError(taker, sellOrder.taker).rrevert();
    }
    // Check that the order is valid and has not expired, been cancelled,
    // or been filled.
    if (orderInfo.status != LibShoyuNFTOrder.OrderStatus.FILLABLE) {
      LibNFTOrdersRichErrors
        .OrderNotFillableError(
          sellOrder.maker,
          sellOrder.nonce,
          uint8(orderInfo.status)
        )
        .rrevert();
    }
    // Check the signature.
    _validateOrderSignature(orderInfo.orderHash, signature, sellOrder.maker);
  }
}