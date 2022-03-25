pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "../0x/features/libs/LibNFTOrder.sol";
import "../0x/features/libs/LibSignature.sol";
import "../0x/vendor/IERC721Token.sol";
import "./LibShoyuNFTOrder.sol";

interface IShoyuERC721OrdersFeature {
  /// @dev Sells an ERC721 asset to fill the given order.
  /// @param buyOrder The ERC721 buy order.
  /// @param signature The order signature from the maker.
  /// @param erc721TokenId The ID of the ERC721 asset being
  ///        sold. If the given order specifies properties,
  ///        the asset must satisfy those properties. Otherwise,
  ///        it must equal the tokenId in the order.
  /// @param unwrapNativeToken If this parameter is true and the
  ///        ERC20 token of the order is e.g. WETH, unwraps the
  ///        token before transferring it to the taker.
  /// @param callbackData If this parameter is non-zero, invokes
  ///        `zeroExERC721OrderCallback` on `msg.sender` after
  ///        the ERC20 tokens have been transferred to `msg.sender`
  ///        but before transferring the ERC721 asset to the buyer.
  function sellAndSwapERC721(
    LibNFTOrder.ERC721Order calldata buyOrder,
    LibSignature.Signature calldata signature,
    uint256 erc721TokenId,
    bool unwrapNativeToken,
    bytes calldata callbackData,
    IERC20TokenV06 outputToken,
    uint256 minAmountOut
  ) external;

  /// @dev Buys an ERC721 asset by filling the given order.
  /// @param sellOrder The ERC721 sell order.
  /// @param signature The order signature.
  /// @param callbackData If this parameter is non-zero, invokes
  ///        `zeroExERC721OrderCallback` on `msg.sender` after
  ///        the ERC721 asset has been transferred to `msg.sender`
  ///        but before transferring the ERC20 tokens to the seller.
  ///        Native tokens acquired during the callback can be used
  ///        to fill the order.
  function buyAndSwapERC721(
    LibNFTOrder.ERC721Order calldata sellOrder,
    LibSignature.Signature calldata signature,
    bytes calldata callbackData,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails
  ) external payable;

  /// @dev Emitted whenever an `ERC721Order` is filled.
  /// @param direction Whether the order is selling or
  ///        buying the ERC721 token.
  /// @param maker The maker of the order.
  /// @param taker The taker of the order.
  /// @param nonce The unique maker nonce in the order.
  /// @param erc20Token The address of the ERC20 token.
  /// @param erc20TokenAmount The amount of ERC20 token
  ///        to sell or buy.
  /// @param erc721Token The address of the ERC721 token.
  /// @param erc721TokenId The ID of the ERC721 asset.
  /// @param matcher If this order was matched with another using `matchERC721Orders()`,
  ///                this will be the address of the caller. If not, this will be `address(0)`.
  event ERC721OrderFilled(
    LibNFTOrder.TradeDirection direction,
    address maker,
    address taker,
    uint256 nonce,
    IERC20TokenV06 erc20Token,
    uint256 erc20TokenAmount,
    IERC721Token erc721Token,
    uint256 erc721TokenId,
    address matcher
  );
}
