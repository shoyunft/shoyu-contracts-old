pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "../0x/features/libs/LibSignature.sol";
import "./LibShoyuNFTOrder.sol";

interface IShoyuNFTOrdersFeature {
  /// @dev Sells an NFT asset to fill the given order.
  /// @param buyOrder The NFT buy order.
  /// @param signature The order signature from the maker.
  /// @param nftTokenId The ID of the NFT asset being
  ///        sold. If the given order specifies properties,
  ///        the asset must satisfy those properties. Otherwise,
  ///        it must equal the tokenId in the order.
  /// @param unwrapNativeToken If this parameter is true and the
  ///        ERC20 token of the order is e.g. WETH, unwraps the
  ///        token before transferring it to the taker.
  /// @param outputToken The token the seller would like to receive.
  /// @param minAmountOut The minimum amount of outputToken the
  ///        buyer is willint to receive.
  function sellAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 nftTokenId,
    bool unwrapNativeToken,
    IERC20TokenV06 outputToken,
    uint256 minAmountOut
  ) external;

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

  /// @dev Buys NFT assets by filling the given orders with ETH.
  /// @param sellOrders The NFT sell orders.
  /// @param signatures The order signatures.
  /// @param nftBuyAmounts The amount of the NFT assets to buy.
  // function buyNFTs(
  //   LibShoyuNFTOrder.NFTOrder[] calldata sellOrders,
  //   LibSignature.Signature[] calldata signatures,
  //   uint128[] memory nftBuyAmounts,
  //   LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails
  // ) external payable returns (bool[] memory successes);

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
  function validateNFTOrderProperties(
    LibShoyuNFTOrder.NFTOrder calldata order,
    uint256 nftTokenId
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
