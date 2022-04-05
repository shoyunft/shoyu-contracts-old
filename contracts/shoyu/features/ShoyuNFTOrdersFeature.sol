pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../0x/migrations/LibMigrate.sol";
import "../../0x/features/interfaces/IFeature.sol";
import "../../0x/features/libs/LibSignature.sol";
import "../interfaces/IShoyuNFTOrdersFeature.sol";
import "../interfaces/IShoyuNFTOrderEvents.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../fixins/ShoyuNFTOrders.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTOrdersFeature is
  IFeature,
  IShoyuNFTOrdersFeature,
  IShoyuNFTOrderEvents,
  ShoyuNFTOrders
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  constructor(
    address payable _zeroExAddress
  ) public ShoyuNFTOrders(_zeroExAddress) {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.validateNFTOrderSignature.selector);
    _registerFeatureFunction(this.validateNFTOrderProperties.selector);
    _registerFeatureFunction(this.getNFTOrderInfo.selector);
    _registerFeatureFunction(this.getNFTOrderHash.selector);
    _registerFeatureFunction(this.cancelNFTOrder.selector);
    _registerFeatureFunction(this.batchCancelNFTOrders.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }

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
  function validateNFTOrderProperties(
    LibShoyuNFTOrder.NFTOrder memory order,
    uint256 nftTokenId
  ) public override view {
    _validateOrderProperties(order, nftTokenId);
  }
}
