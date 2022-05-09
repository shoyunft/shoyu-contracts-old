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
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/ERC1155OrdersFeature.sol
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/NFTOrders.sol
*/

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-zero-ex/contracts/src/migrations/LibMigrate.sol";
import "@0x/contracts-zero-ex/contracts/src/features/interfaces/IFeature.sol";
import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "../interfaces/IShoyuNFTOrdersFeature.sol";
import "../interfaces/IShoyuNFTOrderEvents.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../fixins/ShoyuNFTOrders.sol";
import "../fixins/ShoyuSpender.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTOrdersFeature is
  IFeature,
  IShoyuNFTOrdersFeature,
  IShoyuNFTOrderEvents,
  ShoyuSpender,
  ShoyuNFTOrders
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  constructor(
    address payable _shoyuExAddress,
    IEtherTokenV06 _weth
  ) public
    ShoyuNFTOrders(_shoyuExAddress, _weth)
    ShoyuSpender(_weth)
  {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.validateNFTOrderSignature.selector);
    _registerFeatureFunction(this.validateTokenIdMerkleProof.selector);
    _registerFeatureFunction(this.getNFTOrderInfo.selector);
    _registerFeatureFunction(this.getNFTOrderHash.selector);
    _registerFeatureFunction(this.cancelNFTOrder.selector);
    _registerFeatureFunction(this.batchCancelNFTOrders.selector);
    _registerFeatureFunction(this.batchTransferNFTs.selector);
    _registerFeatureFunction(this.batchTransferAndCancel.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }

  /// Copied from 0x's `cancelERC1155Order()`
  /// @dev Cancel a single NFT order by its nonce. The caller
  ///      should be the maker of the order. Silently succeeds if
  ///      an order with the same nonce has already been filled or
  ///      cancelled.
  /// @param orderNonce The order nonce.
  function cancelNFTOrder(uint256 orderNonce)
    public
    override
  {
    // The bitvector is indexed by the lower 8 bits of the nonce.
    uint256 flag = 1 << (orderNonce & 255);
    // Update order cancellation bit vector to indicate that the order
    // has been cancelled/filled by setting the designated bit to 1.
    LibShoyuNFTOrdersStorage.getStorage().orderCancellationByMaker
      [msg.sender][uint248(orderNonce >> 8)] |= flag;

    emit NFTOrderCancelled(msg.sender, orderNonce);
  }

  /// Copied from 0x's `batchCancelERC1155Orders()`
  /// @dev Cancel multiple NFT orders by their nonces. The caller
  ///      should be the maker of the orders. Silently succeeds if
  ///      an order with the same nonce has already been filled or
  ///      cancelled.
  /// @param orderNonces The order nonces.
  function batchCancelNFTOrders(uint256[] calldata orderNonces)
    external
    override
  {
    for (uint256 i = 0; i < orderNonces.length; i++) {
      cancelNFTOrder(orderNonces[i]);
    }
  }

  /// @dev Transfer multiple NFT assets from `msg.sender` to another user.
  /// @param nftContracts The NFT contract addresses.
  /// @param nftStandards The standard for each NFT.
  /// @param nftTokenIds The NFT token ids.
  /// @param transferAmounts The amounts of each NFT asset to transfer.
  /// @param recipient The recipient of the transfers
  function batchTransferNFTs(
    address[] memory nftContracts,
    LibShoyuNFTOrder.NFTStandard[] memory nftStandards,
    uint256[] memory nftTokenIds,
    uint128[] memory transferAmounts,
    address recipient
  )
    public
    override
  {
    require(
      nftContracts.length == nftTokenIds.length &&
      nftContracts.length == transferAmounts.length,
      "batchTransferNFTs/ARRAY_LENGTH_MISMATCH"
    );

    for (uint256 i = 0; i < nftContracts.length; i++) {
      _transferNFTAssetFrom(
        nftStandards[i],
        nftContracts[i],
        msg.sender,
        recipient,
        nftTokenIds[i],
        transferAmounts[i]
      );
    }
  }

  /// @dev Transfer multiple NFT assets from `msg.sender` to
  ///      another user and cancel multiple orders.
  /// @param nftContracts The NFT contract addresses.
  /// @param nftStandards The standard for each NFT.
  /// @param nftTokenIds The NFT token ids.
  /// @param transferAmounts The amounts of each NFT asset to transfer.
  /// @param recipient The recipient of the transfers
  /// @param orderNonces The nonces of the NFT orders to cancel.
  function batchTransferAndCancel(
    address[] memory nftContracts,
    LibShoyuNFTOrder.NFTStandard[] memory nftStandards,
    uint256[] memory nftTokenIds,
    uint128[] memory transferAmounts,
    address recipient,
    uint256[] memory orderNonces
  ) external override
  {
    require(
      nftContracts.length == nftTokenIds.length &&
      nftContracts.length == transferAmounts.length,
      "batchTransferNFTs/ARRAY_LENGTH_MISMATCH"
    );

    for (uint256 i = 0; i < nftContracts.length; i++) {
      _transferNFTAssetFrom(
        nftStandards[i],
        nftContracts[i],
        msg.sender,
        recipient,
        nftTokenIds[i],
        transferAmounts[i]
      );
    }

    for (uint256 i = 0; i < orderNonces.length; i++) {
      cancelNFTOrder(orderNonces[i]);
    }
  }

  // Copied from 0x's `validateERC1155OrderSignature()`
  /// @dev Checks whether the given signature is valid for the
  ///      the given NFT order. Reverts if not.
  /// @param order The NFT order.
  /// @param signature The signature to validate.
  function validateNFTOrderSignature(
    LibShoyuNFTOrder.NFTOrder memory order,
    LibSignature.Signature memory signature
  )
    public
    override
    view
  {
    bytes32 orderHash = getNFTOrderHash(order);
    _validateOrderSignature(orderHash, signature, order.maker);
  }

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function getNFTOrderInfo(LibShoyuNFTOrder.NFTOrder memory order)
    public
    view
    override
    returns (LibShoyuNFTOrder.OrderInfo memory orderInfo)
  {
    return _getNFTOrderInfo(order);
  }

  /// @dev Get the EIP-712 hash of an NFT order.
  /// @param order The NFT order.
  /// @return orderHash The order hash.
  function getNFTOrderHash(LibShoyuNFTOrder.NFTOrder memory order)
    public
    view
    override
    returns (bytes32 orderHash)
  {
    return _getNFTOrderHash(order);
  }

  /// @dev If the given order is buying an NFT asset, checks
  ///      whether or not the given token ID satisfies the required
  ///      properties specified in the order. If the order does not
  ///      specify any properties, this function instead checks
  ///      whether the given token ID matches the ID in the order.
  ///      Reverts if any checks fail, or if the order is selling
  ///      an NFT asset.
  /// @param order The NFT order.
  /// @param nftTokenId The ID of the NFT asset.
  function validateTokenIdMerkleProof(
    LibShoyuNFTOrder.NFTOrder memory order,
    uint256 nftTokenId,
    bytes32[] memory tokenIdMerkleProof
  ) public override view {
    _validateTokenIdMerkleProof(order, nftTokenId, tokenIdMerkleProof);
  }
}
