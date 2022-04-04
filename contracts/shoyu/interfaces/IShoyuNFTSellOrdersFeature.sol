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
  /// @param sellOrders The NFT sell order.
  /// @param signatures The order signature.
  /// @param nftBuyAmounts The amount of the NFT assets to buy.
  /// @param revertIfIncomplete If true, reverts if this
  ///        function fails to fill any individual order.
  /// @return successes An array of booleans corresponding to whether
  ///         each order in `orders` was successfully filled.
  function buyNFTs(
    LibShoyuNFTOrder.NFTOrder[] calldata sellOrders,
    LibSignature.Signature[] calldata signatures,
    uint128[] calldata nftBuyAmounts,
    bool revertIfIncomplete
  ) external payable returns (bool[] memory successes);

  /// @dev Buys an NFT asset by filling the given order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param nftBuyAmount The amount of the NFT asset to buy.
  /// @param swapDetails The swap details required to fill the order.
  function buyAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder calldata sellOrder,
    LibSignature.Signature calldata signature,
    uint128 nftBuyAmount,
    LibShoyuNFTOrder.SwapExactOutDetails[] calldata swapDetails
  ) external payable;

  /// @dev Buys NFT assets by filling the given orders.
  /// @param sellOrders The NFT sell orders.
  /// @param signatures The order signatures.
  /// @param nftBuyAmounts The amount of the NFT assets to buy.
  /// @param swapDetails The swap details required to fill the orders.
  /// @param revertIfIncomplete If true, reverts if this
  ///        function fails to fill any individual order.
  /// @return successes An array of booleans corresponding to whether
  ///         each order in `orders` was successfully filled.
  function buyAndSwapNFTs(
    LibShoyuNFTOrder.NFTOrder[] calldata sellOrders,
    LibSignature.Signature[] calldata signatures,
    uint128[] calldata nftBuyAmounts,
    LibShoyuNFTOrder.SwapExactOutDetails[] calldata swapDetails,
    bool revertIfIncomplete
  ) external payable returns (bool[] memory successes);
}