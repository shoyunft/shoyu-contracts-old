// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2021 ZeroEx Intl.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Files referenced:
  - https://github.com/0xProject/protocol/blob/c1177416f5A0c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/NFTOrders.sol
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/ERC1155OrdersFeature.sol
*/

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "./ShoyuNFTOrders.sol";

abstract contract ShoyuNFTSellOrders is ShoyuNFTOrders {
  constructor(
    address payable _shoyuExAddress,
    IEtherTokenV06 _weth
  ) public ShoyuNFTOrders(_shoyuExAddress, _weth)
  {}

  // Adapted 0x's `_validateSellOrder` in `NFTOrders.sol`
  // Changes made:
  // - Restrict `sellOrder.erc20Token` to only ETH
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