pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "../libraries/LibShoyuNFTOrder.sol";

interface IShoyuNFTOrderEvents {
  /// @dev Emitted whenever an `NFTOrder` is cancelled.
  /// @param maker The maker of the order.
  /// @param nonce The nonce of the order that was cancelled.
  event NFTOrderCancelled(
    address maker,
    uint256 nonce
  );

  /// @dev Emitted whenever an `NFTOrder` is filled.
  /// @param direction Whether the order is selling or
  ///        buying the NFT token.
  /// @param maker The maker of the order.
  /// @param taker The taker of the order.
  /// @param nonce The unique maker nonce in the order.
  /// @param erc20Token The address of the NFT token.
  /// @param erc20TokenAmount The amount of NFT token
  ///        to sell or buy.
  /// @param nftToken The address of the NFT token.
  /// @param nftTokenId The ID of the NFT asset.
  /// @param nftTokenAmount The amount of the NFT asset.
  event NFTOrderFilled(
    LibShoyuNFTOrder.TradeDirection direction,
    address maker,
    address taker,
    uint256 nonce,
    IERC20TokenV06 erc20Token,
    uint256 erc20TokenAmount,
    address nftToken,
    uint256 nftTokenId,
    uint128 nftTokenAmount
  );
}