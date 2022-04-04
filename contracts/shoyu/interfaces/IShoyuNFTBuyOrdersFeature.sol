pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "../../0x/features/libs/LibSignature.sol";
import "../libraries/LibShoyuNFTOrder.sol";

interface IShoyuNFTBuyOrdersFeature {
  /// @dev Sells an NFT asset to fill the given order.
  /// @param buyOrder The NFT buy order.
  /// @param signature The order signature from the maker.
  /// @param nftTokenId The ID of the NFT asset being
  ///        sold. If the given order specifies properties,
  ///        the asset must satisfy those properties. Otherwise,
  ///        it must equal the tokenId in the order.
  /// @param nftSellAmount The amount of the NFT asset
  ///        to sell.
  /// @param unwrapNativeToken If this parameter is true and the
  ///        ERC20 token of the order is e.g. WETH, unwraps the
  ///        token before transferring it to the taker.
  function sellNFT(
    LibShoyuNFTOrder.NFTOrder calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    bool unwrapNativeToken
  ) external;

  /// @dev Sells an NFT asset to fill the given order.
  /// @param buyOrder The NFT buy order.
  /// @param signature The order signature from the maker.
  /// @param nftTokenId The ID of the NFT asset being
  ///        sold. If the given order specifies properties,
  ///        the asset must satisfy those properties. Otherwise,
  ///        it must equal the tokenId in the order.
  /// @param swapDetails The details of the swap the seller would
  ///        like to perform.
  function sellAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 nftTokenId,
    LibShoyuNFTOrder.SwapExactInDetails calldata swapDetails
  ) external;
}