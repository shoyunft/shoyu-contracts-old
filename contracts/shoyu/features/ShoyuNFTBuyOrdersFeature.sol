pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../0x/migrations/LibMigrate.sol";
import "../../0x/features/interfaces/IFeature.sol";
import "../../0x/features/libs/LibSignature.sol";
import "../../0x/fixins/FixinCommon.sol";
import "../../0x/fixins/FixinTokenSpender.sol";
import "../../0x/errors/LibNFTOrdersRichErrors.sol";
import "../interfaces/IShoyuNFTBuyOrdersFeature.sol";
import "../interfaces/IShoyuNFTOrderEvents.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../fixins/ShoyuSwapper.sol";
import "../fixins/ShoyuNFTBuyOrders.sol";
import "../fixins/ShoyuSpender.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTBuyOrdersFeature is
  IFeature,
  IShoyuNFTBuyOrdersFeature,
  IShoyuNFTOrderEvents,
  FixinCommon,
  FixinTokenSpender,
  ShoyuNFTBuyOrders,
  ShoyuSpender,
  ShoyuSwapper
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTBuyOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  struct SellParams {
    uint128 sellAmount;
    uint256 tokenId;
    bool unwrapNativeToken;
    address taker;
    address currentNftOwner;
    bytes32[] tokenIdMerkleProof;
  }

  constructor(
    address payable _zeroExAddress,
    IEtherTokenV06 _weth,
    address _factory,
    bytes32 _pairCodeHash
  ) public
    ShoyuNFTBuyOrders(_zeroExAddress)
    ShoyuSpender(_weth)
    ShoyuSwapper(_factory, _pairCodeHash)
  {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.sellNFT.selector);
    _registerFeatureFunction(this.sellAndSwapNFT.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }

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
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    bool unwrapNativeToken,
    bytes32[] memory tokenIdMerkleProof
  )
    public
    override
  {
    _sellNFT(
      buyOrder,
      signature,
      SellParams(
        nftSellAmount,
        nftTokenId,
        unwrapNativeToken,
        msg.sender, // taker
        msg.sender, // owner
        tokenIdMerkleProof
      )
    );
  }

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
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 nftTokenId,
    LibShoyuNFTOrder.SwapExactInDetails memory swapDetails,
    bytes32[] memory tokenIdMerkleProof
  ) public override {
    require(
      swapDetails.path[0] == address(buyOrder.erc20Token),
      "sellAndSwapNFT::TOKEN_MISMATCH"
    );

    uint256 erc20FillAmount = _sellNFT(
      buyOrder,
      signature,
      SellParams(
        buyOrder.nftTokenAmount,
        nftTokenId,
        false, // unwrapNativeToken
        address(this), // taker - set to `this` so we can swap the funds before sending funds to taker
        msg.sender, // owner
        tokenIdMerkleProof
      )
    );

    _swapExactTokensForTokens(erc20FillAmount, swapDetails.amountOutMin, swapDetails.path, msg.sender);
  }

  // Core settlement logic for selling an NFT asset.
  function _sellNFT(
      LibShoyuNFTOrder.NFTOrder memory buyOrder,
      LibSignature.Signature memory signature,
      SellParams memory params
  ) internal returns (uint256 erc20FillAmount) {
    LibShoyuNFTOrder.OrderInfo memory orderInfo = _getNFTOrderInfo(buyOrder);

    // Check that the order can be filled.
    _validateBuyOrder(
      buyOrder,
      signature,
      orderInfo,
      params.taker,
      params.tokenId,
      params.tokenIdMerkleProof
    );

    if (params.sellAmount > orderInfo.remainingAmount) {
      LibNFTOrdersRichErrors
        .ExceedsRemainingOrderAmount(
          orderInfo.remainingAmount,
          params.sellAmount
        )
        .rrevert();
    }

    _updateOrderState(orderInfo.orderHash, params.sellAmount);
    
    if (params.sellAmount == orderInfo.orderAmount) {
      erc20FillAmount = buyOrder.erc20TokenAmount;
    } else {
      // Rounding favors the order maker.
      erc20FillAmount = LibMathV06.getPartialAmountFloor(
        params.sellAmount,
        orderInfo.orderAmount,
        buyOrder.erc20TokenAmount
      );
    }

    if (params.unwrapNativeToken) {
      // The ERC20 token must be WETH for it to be unwrapped.
      if (buyOrder.erc20Token != WETH) {
        LibNFTOrdersRichErrors.ERC20TokenMismatchError(
            address(buyOrder.erc20Token),
            address(WETH)
        ).rrevert();
      }

      // Transfer the WETH from the maker to the Exchange Proxy
      // so we can unwrap it before sending it to the seller.
      // TODO: Probably safe to just use WETH.transferFrom for some
      //       small gas savings
      _transferERC20TokensFrom(
        WETH,
        buyOrder.maker,
        address(this),
        erc20FillAmount
      );

      // Unwrap WETH into ETH.
      WETH.withdraw(erc20FillAmount);

      // Send ETH to the seller.
      _transferEth(payable(params.taker), erc20FillAmount);
    } else {
      // Transfer the ERC20 token from the buyer to the seller.
      _transferERC20TokensFrom(
        buyOrder.erc20Token,
        buyOrder.maker,
        params.taker,
        erc20FillAmount
      );
    }

    // Transfer the NFT asset to the buyer.
    // If this function is called from the
    // `onNFTReceived` callback the Exchange Proxy
    // holds the asset. Otherwise, transfer it from
    // the seller.
    _transferNFTAssetFrom(
      buyOrder.nftStandard,
      buyOrder.nftToken,
      params.currentNftOwner,
      buyOrder.maker,
      params.tokenId,
      params.sellAmount
    );

    // The buyer pays the order fees.
    _payFees(
      buyOrder,
      buyOrder.maker,
      params.sellAmount,
      orderInfo.orderAmount,
      false
    );
    
    emit NFTOrderFilled(
      buyOrder.direction,
      buyOrder.maker,
      msg.sender,
      buyOrder.nonce,
      buyOrder.erc20Token,
      buyOrder.erc20TokenAmount,
      buyOrder.nftToken,
      params.tokenId,
      buyOrder.nftTokenAmount
    );
  }
}
