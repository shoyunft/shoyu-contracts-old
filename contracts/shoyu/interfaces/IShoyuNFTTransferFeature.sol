pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibShoyuNFTOrder.sol";
interface IShoyuNFTTransferFeature {
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
  ) external;
}