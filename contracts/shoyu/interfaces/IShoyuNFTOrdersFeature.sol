pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../0x/features/libs/LibSignature.sol";
import "../libraries/LibShoyuNFTOrder.sol";

interface IShoyuNFTOrdersFeature {
  /// @dev Cancel a single NFT order by its nonce. The caller
  ///      should be the maker of the order. Silently succeeds if
  ///      an order with the same nonce has already been filled or
  ///      cancelled.
  /// @param orderNonce The order nonce.
  function cancelNFTOrder(uint256 orderNonce)
      external;

  /// @dev Cancel multiple NFT orders by their nonces. The caller
  ///      should be the maker of the orders. Silently succeeds if
  ///      an order with the same nonce has already been filled or
  ///      cancelled.
  /// @param orderNonces The order nonces.
  function batchCancelNFTOrders(uint256[] calldata orderNonces)
      external;

  /// @dev Transfer multiple NFT assets from `msg.sender` to
  ///      another user and cancel multiple orders.
  /// @param nftContracts The NFT contract addresses.
  /// @param nftStandards The standard for each NFT.
  /// @param nftTokenIds The NFT token ids.
  /// @param transferAmounts The amounts of each NFT asset to transfer.
  /// @param recipient The recipient of the transfers
  /// @param orderNonces The nonces of the NFT orders to cancel.
  function batchTransferAndCancel(
    address[] calldata nftContracts,
    LibShoyuNFTOrder.NFTStandard[] calldata nftStandards,
    uint256[] calldata nftTokenIds,
    uint128[] calldata transferAmounts,
    address recipient,
    uint256[] calldata orderNonces
  ) external;

  /// @dev Approves an NFT order on-chain. After pre-signing
  ///      the order, the `PRESIGNED` signature type will become
  ///      valid for that order and signer.
  /// @param order An NFT order.
  // function preSignNFTOrder(LibShoyuNFTOrder.NFTOrder calldata order) external;

  /// @dev Checks whether the given signature is valid for the
  ///      the given NFT order. Reverts if not.
  /// @param order The NFT order.
  /// @param signature The signature to validate.
  function validateNFTOrderSignature(
    LibShoyuNFTOrder.NFTOrder calldata order,
    LibSignature.Signature calldata signature
  ) external view;

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
    LibShoyuNFTOrder.NFTOrder calldata order,
    uint256 nftTokenId,
    bytes32[] calldata proof
  ) external view;

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Infor about the order.
  function getNFTOrderInfo(LibShoyuNFTOrder.NFTOrder calldata order)
    external
    view
    returns (LibShoyuNFTOrder.OrderInfo memory orderInfo);

  /// @dev Get the EIP-712 hash of an NFT order.
  /// @param order The NFT order.
  /// @return orderHash The order hash.
  function getNFTOrderHash(LibShoyuNFTOrder.NFTOrder calldata order)
    external
    view
    returns (bytes32 orderHash);
}