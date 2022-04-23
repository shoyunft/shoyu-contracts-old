pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "../../0x/errors/LibNFTOrdersRichErrors.sol";
import "../../0x/features/libs/LibSignature.sol";
import "../../0x/fixins/FixinCommon.sol";
import "../../0x/fixins/FixinEIP712.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";

abstract contract ShoyuNFTOrders is
  FixinCommon,
  FixinEIP712
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  constructor(
    address payable _zeroExAddress
  ) public FixinEIP712(_zeroExAddress)
  {}

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
  ) internal view {
    if (signature.signatureType == LibSignature.SignatureType.PRESIGNED) {
      // Check if order hash has been pre-signed by the maker.
      bool isPreSigned = LibShoyuNFTOrdersStorage
        .getStorage()
        .orderState[orderHash]
        .preSigned;
      if (!isPreSigned) {
        LibNFTOrdersRichErrors.InvalidSignerError(maker, address(0)).rrevert();
      }
    } else {
      address signer = LibSignature.getSignerOfHash(orderHash, signature);
      if (signer != maker) {
        LibNFTOrdersRichErrors.InvalidSignerError(maker, signer).rrevert();
      }
    }
  }

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
    // b) if merkle root == 0xfff...f, any tokenId can fill order *
    // TODO: *is there some better way of handling this?
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