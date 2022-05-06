pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
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
  /// @param nftTokenIdMerkleProof The merkle proof used in
  ///        combination with `nftTokenId` and
  ///        `buyOrder.nftTokenIdMerkleRoot` to prove that
  ///        `nftTokenId` can fill the buy order.
  function sellNFT(
    LibShoyuNFTOrder.NFTOrder calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    bool unwrapNativeToken,
    bytes32[] calldata nftTokenIdMerkleProof
  ) external;

  /// @dev Sells an NFT asset to fill the given order.
  /// @param buyOrder The NFT buy order.
  /// @param signature The order signature from the maker.
  /// @param nftTokenId The ID of the NFT asset being
  ///        sold. If the given order specifies properties,
  ///        the asset must satisfy those properties. Otherwise,
  ///        it must equal the tokenId in the order.
  /// @param nftSellAmount The amount of the NFT asset to sell.
  /// @param swapDetails The details of the swap the seller would
  ///        like to perform.
  /// @param nftTokenIdMerkleProof The merkle proof used in
  ///        combination with `nftTokenId` and
  ///        `buyOrder.nftTokenIdMerkleRoot` to prove that
  ///        `nftTokenId` can fill the buy order.
  function sellAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    LibShoyuNFTOrder.SwapExactInDetails calldata swapDetails,
    bytes32[] calldata nftTokenIdMerkleProof
  ) external;

  /// @dev Callback for the ERC721 `safeTransferFrom` function.
  ///      This callback can be used to sell an ERC721 asset if
  ///      a valid ERC721 order, signature and `unwrapNativeToken`
  ///      are encoded in `data`. This allows takers to sell their
  ///      ERC721 asset without first calling `setApprovalForAll`.
  /// @param operator The address which called `safeTransferFrom`.
  /// @param from The address which previously owned the token.
  /// @param tokenId The ID of the asset being transferred.
  /// @param data Additional data with no specified format. If a
  ///        valid ERC721 order, signature and `unwrapNativeToken`
  ///        are encoded in `data`, this function will try to fill
  ///        the order using the received asset.
  /// @return success The selector of this function (0x150b7a02),
  ///         indicating that the callback succeeded.
  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  )
    external
    returns (bytes4 success);

  /// @dev Callback for the ERC1155 `safeTransferFrom` function.
  ///      This callback can be used to sell an ERC1155 asset if
  ///      a valid ERC1155 order, signature and `unwrapNativeToken`
  ///      are encoded in `data`. This allows takers to sell their
  ///      ERC1155 asset without first calling `setApprovalForAll`.
  /// @param operator The address which called `safeTransferFrom`.
  /// @param from The address which previously owned the token.
  /// @param tokenId The ID of the asset being transferred.
  /// @param value The amount being transferred.
  /// @param data Additional data with no specified format. If a
  ///        valid ERC1155 order, signature and `unwrapNativeToken`
  ///        are encoded in `data`, this function will try to fill
  ///        the order using the received asset.
  /// @return success The selector of this function (0xf23a6e61),
  ///         indicating that the callback succeeded.
  function onERC1155Received(
    address operator,
    address from,
    uint256 tokenId,
    uint256 value,
    bytes calldata data
  )
    external
    returns (bytes4 success);
}