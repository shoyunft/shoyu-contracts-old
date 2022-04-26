pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "../../0x/fixins/FixinERC721Spender.sol";
import "../../0x/fixins/FixinERC1155Spender.sol";
import "../../0x/fixins/FixinTokenSpender.sol";
import "../../0x/errors/LibNFTOrdersRichErrors.sol";
import "../../0x/vendor/IFeeRecipient.sol";
import "../libraries/LibShoyuNFTOrder.sol";

abstract contract ShoyuSpender is
  FixinTokenSpender,
  FixinERC721Spender,
  FixinERC1155Spender
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev The magic return value indicating the success of a `receiveZeroExFeeCallback`.
  bytes4 private constant FEE_CALLBACK_MAGIC_BYTES =
    IFeeRecipient.receiveZeroExFeeCallback.selector;

  /// @dev The WETH token contract.
  IEtherTokenV06 internal immutable WETH;

  constructor(IEtherTokenV06 _weth) public {
    WETH = _weth;
  }

  /// @dev Transfers an NFT asset.
  /// @param token The address of the NFT contract.
  /// @param from The address currently holding the asset.
  /// @param to The address to transfer the asset to.
  /// @param tokenId The ID of the asset to transfer.
  /// @param amount The amount of the asset to transfer. Always
  ///        1 for ERC721 assets.
  function _transferNFTAssetFrom(
    LibShoyuNFTOrder.NFTStandard nftStandard,
    address token,
    address from,
    address to,
    uint256 tokenId,
    uint128 amount
  ) internal {
    if (nftStandard == LibShoyuNFTOrder.NFTStandard.ERC721) {
      assert (amount == 1);
      _transferERC721AssetFrom(IERC721Token(token), from, to, tokenId);
    } else {
      _transferERC1155AssetFrom(IERC1155Token(token), from, to, tokenId, amount);
    }
  }

  function _payEthFees(
    LibShoyuNFTOrder.NFTOrder memory order,
    uint128 fillAmount,
    uint128 orderAmount,
    uint256 ethSpent,
    uint256 ethAvailable
  ) internal {
    // Pay fees using ETH.
    uint256 ethFees = _payFees(
      order,
      address(this),
      fillAmount,
      orderAmount,
      true
    );
    // Update amount of ETH spent.
    ethSpent = ethSpent.safeAdd(ethFees);
    // TODO: why won't this compile??
    // if (ethSpent > ethAvailable) {
    //   LibNFTOrdersRichErrors.OverspentEthError(ethSpent, ethAvailable).rrevert();
    // }
    require(
      ethSpent <= ethAvailable,
      "_payEthFees/OVERSPENT_ETH"
    );
  }

  function _payFees(
    LibShoyuNFTOrder.NFTOrder memory order,
    address payer,
    uint128 fillAmount,
    uint128 orderAmount,
    bool useNativeToken
  ) internal returns (uint256 totalFeesPaid) {
    // Make assertions about ETH case
    if (useNativeToken) {
      assert(payer == address(this));
      assert(
        order.erc20Token == WETH ||
          address(order.erc20Token) == LibShoyuNFTOrder.NATIVE_TOKEN_ADDRESS
      );
    }

    for (uint256 i = 0; i < order.fees.length; i++) {
      LibShoyuNFTOrder.Fee memory fee = order.fees[i];

      require(
        fee.recipient != address(this),
        "_payFees/RECIPIENT_CANNOT_BE_EXCHANGE_PROXY"
      );

      uint256 feeFillAmount;
      if (fillAmount == orderAmount) {
        feeFillAmount = fee.amount;
      } else {
        // Round against the fee recipient
        feeFillAmount = LibMathV06.getPartialAmountFloor(
          fillAmount,
          orderAmount,
          fee.amount
        );
      }
      if (feeFillAmount == 0) {
        continue;
      }

      if (useNativeToken) {
        // Transfer ETH to the fee recipient.
        _transferEth(payable(fee.recipient), feeFillAmount);
      } else {
        // Transfer ERC20 token from payer to recipient.
        _transferERC20TokensFrom(
          order.erc20Token,
          payer,
          fee.recipient,
          feeFillAmount
        );
      }

      // Sum the fees paid
      totalFeesPaid = totalFeesPaid.safeAdd(feeFillAmount);
    }
  }
}