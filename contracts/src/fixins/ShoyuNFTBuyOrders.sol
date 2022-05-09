
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
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/NFTOrders.sol 
*/

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "./ShoyuNFTOrders.sol";

abstract contract ShoyuNFTBuyOrders is ShoyuNFTOrders {
  constructor(
    address payable _shoyuExAddress,
    IEtherTokenV06 _weth
  ) public ShoyuNFTOrders(_shoyuExAddress, _weth)
  {}

  // Adapted from 0x's `_validateBuyOrder()` in `NFTOrders.sol`
  // Changes made:
  // - Restricted `buyOrder.erc20Token` to WETH
  // - Added `tokenIdMerkleProof`
  // - Replaced `_validateOrderProperties()` with `_validateTokenIdMerkleProof()`
  function _validateBuyOrder(
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    LibShoyuNFTOrder.OrderInfo memory orderInfo,
    address taker,
    uint256 tokenId,
    bytes32[] memory tokenIdMerkleProof
  ) internal view {
    // Order must be buying the NFT asset.
    require(
      buyOrder.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT,
      "_validateBuyOrder::WRONG_TRADE_DIRECTION"
    );

    // The ERC20 token must be WETH.
    require(
      address(buyOrder.erc20Token) == address(WETH),
      "_validateBuyOrder::WRAPPED_NATIVE_TOKEN_ONLY"
    );

    // Taker must match the order taker, if one is specified.
    if (buyOrder.taker != address(0) && buyOrder.taker != taker) {
      LibNFTOrdersRichErrors.OnlyTakerError(taker, buyOrder.taker).rrevert();
    }

    // Check that the order is valid and has not expired, been cancelled,
    // or been filled.
    if (orderInfo.status != LibShoyuNFTOrder.OrderStatus.FILLABLE) {
      LibNFTOrdersRichErrors
        .OrderNotFillableError(
          buyOrder.maker,
          buyOrder.nonce,
          uint8(orderInfo.status)
        )
        .rrevert();
    }

    // Check that the asset with the given token ID satisfies the merkle root
    // specified by the order.
    _validateTokenIdMerkleProof(buyOrder, tokenId, tokenIdMerkleProof);

    // Check the signature.
    _validateOrderSignature(orderInfo.orderHash, signature, buyOrder.maker);
  }
}