pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../0x/features/libs/LibSignature.sol";
import "../libraries/LibShoyuNFTOrder.sol";

interface IShoyuNFTSellOrdersFeature {
  /// @dev Buys an NFT asset by filling the given order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param nftBuyAmount The amount of the NFT asset
  ///        to buy.
  function buyNFT(
    LibShoyuNFTOrder.NFTOrder calldata sellOrder,
    LibSignature.Signature calldata signature,
    uint128 nftBuyAmount
  ) external payable;

  /// @dev Buys an NFT asset by filling the given order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param nftBuyAmount The amount of the NFT asset to buy.
  /// @param swapDetails The swap details required to fill the order.
  function buyAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder calldata sellOrder,
    LibSignature.Signature calldata signature,
    uint128 nftBuyAmount,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails
  ) external payable;

  /// @dev Buys NFT assets by filling the given orders.
  /// @param sellOrders The NFT sell orders.
  /// @param signatures The order signatures.
  /// @param nftBuyAmounts The amount of the NFT assets to buy.
  /// @param swapDetails The swap details required to fill the orders.
  function buyAndSwapNFTs(
    LibShoyuNFTOrder.NFTOrder[] calldata sellOrders,
    LibSignature.Signature[] calldata signatures,
    uint128[] memory nftBuyAmounts,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails,
    bool revertIfIncomplete
  ) external payable returns (bool[] memory successes);
}