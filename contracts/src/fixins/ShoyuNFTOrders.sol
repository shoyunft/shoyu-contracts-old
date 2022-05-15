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

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinCommon.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../fixins/FixinEIP712.sol";

abstract contract ShoyuNFTOrders is
  FixinCommon,
  FixinEIP712
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev The WETH token contract.
  IEtherTokenV06 internal immutable WETH;

  constructor(
    address payable _shoyuExAddress,
    IEtherTokenV06 _weth
  ) public FixinEIP712(_shoyuExAddress) {
    WETH = _weth;
  }

  /// From 0x's `_validateOrderSignature()` in `ERC1155OrdersFeature.sol`
  /// @dev Validates that the given signature is valid for the
  ///      given maker and order hash. Reverts if the signature
  ///      is not valid.
  /// @param orderHash The hash of the order that was signed.
  /// @param signature The signature to check.
  /// @param maker The maker of the order.
  function _validateOrderSignature(
    bytes32 orderHash,
    LibSignature.Signature memory signature,
    address maker
  ) internal pure {
    address signer = LibSignature.getSignerOfHash(orderHash, signature);
    if (signer != maker) {
      LibNFTOrdersRichErrors.InvalidSignerError(maker, signer).rrevert();
    }
  }

  /// From 0x's `_updateOrderState()` in `ERC1155OrdersFeature.sol`
  /// @dev Updates storage to indicate that the given order
  ///      has been filled by the given amount.
  /// @param orderHash The hash of `order`.
  /// @param fillAmount The amount (denominated in the NFT asset)
  ///        that the order has been filled by.
  function _updateOrderState(
    bytes32 orderHash,
    uint128 fillAmount
  ) internal {
    LibShoyuNFTOrdersStorage.Storage storage stor = LibShoyuNFTOrdersStorage
      .getStorage();
    uint128 filledAmount = stor.orderState[orderHash].filledAmount;
    // Filled amount should never overflow 128 bits
    assert(filledAmount + fillAmount > filledAmount);
    stor.orderState[orderHash].filledAmount = filledAmount + fillAmount;
  }

  /// @dev If the given order is buying an NFT asset, checks
  ///      whether or not the given token ID satisfies the required
  ///      properties specified in the order. If the order does not
  ///      specify any properties, this function instead checks
  ///      whether the given token ID matches the ID in the order.
  ///      Reverts if any checks fail, or if the order is selling
  ///      an NFT asset.
  /// @param order The NFT order.
  /// @param tokenId The ID of the NFT asset.
  /// @param tokenIdMerkleProof The Merkle proof that proves inclusion of `tokenId`
  function _validateTokenIdMerkleProof(
    LibShoyuNFTOrder.NFTOrder memory order,
    uint256 tokenId,
    bytes32[] memory tokenIdMerkleProof
  ) internal pure {
    // Order must be buying an NFT asset to have properties.
    require(
      order.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT,
      "_validateTokenIdMerkleProof/WRONG_TRADE_DIRECTION"
    );

    // If no proof is specified, check the order's merkle root
    // a) merkle root == 0, tokenId must match buy order
    // b) if merkle root == 0xfff...f, any tokenId can fill order
    if (tokenIdMerkleProof.length == 0) {
      if (order.nftTokenIdsMerkleRoot == 0) {
        if (tokenId != order.nftTokenId) {
          LibNFTOrdersRichErrors
            .TokenIdMismatchError(tokenId, order.nftTokenId)
            .rrevert();
        }
      } else if (order.nftTokenIdsMerkleRoot != LibShoyuNFTOrder.MAX_MERKLE_ROOT) {
        LibNFTOrdersRichErrors
          .TokenIdMismatchError(tokenId, order.nftTokenId)
          .rrevert();
      }
    } else {
      // Validate merkle proof
      require(
        MerkleProof.verify(tokenIdMerkleProof, order.nftTokenIdsMerkleRoot, keccak256(abi.encodePacked(tokenId))),
        "_validateTokenIdMerkleProof/INVALID_PROOF"
      );
    }
  }

  /// @dev Get the EIP-712 hash of an NFT order.
  /// @param order The NFT order.
  /// @return orderHash The order hash.
  function _getNFTOrderHash(LibShoyuNFTOrder.NFTOrder memory order)
    internal
    view
    returns (bytes32 orderHash)
  {
    return _getEIP712Hash(LibShoyuNFTOrder.getNFTOrderStructHash(order));
  }

  /// From 0x's `getERC1155OrderInfo()` in `ERC1155OrdersFeature.sol`
  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function _getNFTOrderInfo(LibShoyuNFTOrder.NFTOrder memory order)
    internal
    view
    returns (LibShoyuNFTOrder.OrderInfo memory orderInfo)
  {
    orderInfo.orderAmount = order.nftTokenAmount;
    orderInfo.orderHash = _getNFTOrderHash(order);

    // Only buy orders with `nftTokenId` == 0 can be property
    // orders.
    if (
      order.nftTokenIdsMerkleRoot != 0 &&
      (order.direction != LibShoyuNFTOrder.TradeDirection.BUY_NFT ||
        order.nftTokenId != 0)
    ) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.INVALID;
      return orderInfo;
    }

    // Buy orders cannot use ETH as the ERC20 token, since ETH cannot be
    // transferred from the buyer by a contract.
    if (
      order.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT &&
      address(order.erc20Token) == LibShoyuNFTOrder.NATIVE_TOKEN_ADDRESS
    ) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.INVALID;
      return orderInfo;
    }

    // Check for expiry.
    if (order.expiry <= block.timestamp) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.EXPIRED;
      return orderInfo;
    }

    {
      LibShoyuNFTOrdersStorage.Storage storage stor = LibShoyuNFTOrdersStorage
        .getStorage();

      LibShoyuNFTOrdersStorage.OrderState storage orderState = stor.orderState[
        orderInfo.orderHash
      ];
      orderInfo.remainingAmount = order.nftTokenAmount.safeSub128(
        orderState.filledAmount
      );

      // `orderCancellationByMaker` is indexed by maker and nonce.
      uint256 orderCancellationBitVector = stor.orderCancellationByMaker[
        order.maker
      ][uint248(order.nonce >> 8)];
      // The bitvector is indexed by the lower 8 bits of the nonce.
      uint256 flag = 1 << (order.nonce & 255);

      if (
        orderInfo.remainingAmount == 0 || orderCancellationBitVector & flag != 0
      ) {
        orderInfo.status = LibShoyuNFTOrder.OrderStatus.UNFILLABLE;
        return orderInfo;
      }
    }

    // Otherwise, the order is fillable.
    orderInfo.status = LibShoyuNFTOrder.OrderStatus.FILLABLE;
  }
}