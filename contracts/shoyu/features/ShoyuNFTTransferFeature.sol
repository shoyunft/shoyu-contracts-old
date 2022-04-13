pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../0x/migrations/LibMigrate.sol";
import "../../0x/features/interfaces/IFeature.sol";
import "../../0x/fixins/FixinCommon.sol";
import "../fixins/ShoyuSpender.sol";
import "../interfaces/IShoyuNFTTransferFeature.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTTransferFeature is
  IFeature,
  IShoyuNFTTransferFeature,
  FixinCommon,
  ShoyuSpender
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTTransfer";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  constructor(
    IEtherTokenV06 _weth
  ) public
    ShoyuSpender(_weth)
  {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.batchTransferNFTs.selector);
    return LibMigrate.MIGRATE_SUCCESS;
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
}
