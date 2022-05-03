pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../0x/migrations/LibMigrate.sol";
import "../../0x/features/interfaces/IFeature.sol";
import "../../0x/features/libs/LibSignature.sol";
import "../../0x/fixins/FixinCommon.sol";
import "../../0x/fixins/FixinTokenSpender.sol";
import "../../0x/errors/LibNFTOrdersRichErrors.sol";
import "../../sushiswap/uniswapv2/libraries/UniswapV2Library.sol";
import "../interfaces/IShoyuNFTSellOrdersFeature.sol";
import "../interfaces/IShoyuNFTOrderEvents.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../fixins/ShoyuNFTSellOrders.sol";
import "../fixins/ShoyuSpender.sol";
import "../fixins/ShoyuSwapper.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTSellOrdersFeature is
  IFeature,
  IShoyuNFTSellOrdersFeature,
  IShoyuNFTOrderEvents,
  FixinCommon,
  FixinTokenSpender,
  ShoyuNFTSellOrders,
  ShoyuSpender,
  ShoyuSwapper
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTSellOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  struct BuyParams {
    uint128 buyAmount;
    uint256 ethAvailable;
  }

  constructor(
    address payable _zeroExAddress,
    IEtherTokenV06 _weth,
    address _factory,
    bytes32 _pairCodeHash
  ) public
    ShoyuNFTSellOrders(_zeroExAddress, _weth)
    ShoyuSpender(_weth)
    ShoyuSwapper(_factory, _pairCodeHash)
  {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.buyNFT.selector);
    _registerFeatureFunction(this.buyNFTs.selector);
    _registerFeatureFunction(this.swapAndBuyNFT.selector);
    _registerFeatureFunction(this.swapAndBuyNFTs.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }
  /// @dev Buys an NFT asset by filling the given order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param nftBuyAmount The amount of the NFT asset
  ///        to buy.
  function buyNFT(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    uint128 nftBuyAmount
  )
    public
    override
    payable
  {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);

    _buyNFT(
      sellOrder,
      signature,
      BuyParams(
        nftBuyAmount,
        msg.value
      )
    );

    uint256 ethBalanceAfter = address(this).balance;

    // Cannot use pre-existing ETH balance
    if (ethBalanceAfter < ethBalanceBefore) {
      LibNFTOrdersRichErrors.OverspentEthError(
        ethBalanceBefore - ethBalanceAfter + msg.value,
        msg.value
      ).rrevert();
    }

    // Refund
    _transferEth(msg.sender, ethBalanceAfter - ethBalanceBefore);
  }

  /// @dev Buys NFT assets by filling the given orders.
  /// @param sellOrders The NFT sell orders.
  /// @param signatures The order signatures.
  /// @param nftBuyAmounts The amount of the NFT asset to buy.
  /// @param revertIfIncomplete If true, reverts if this
  ///        function fails to fill any individual order.
  /// @return successes An array of booleans corresponding to whether
  ///         each order in `orders` was successfully filled.
  function buyNFTs(
    LibShoyuNFTOrder.NFTOrder[] memory sellOrders,
    LibSignature.Signature[] memory signatures,
    uint128[] memory nftBuyAmounts,
    bool revertIfIncomplete
  ) public payable override returns (bool[] memory successes) {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);

    successes = _buyNFTs(
      sellOrders,
      signatures,
      nftBuyAmounts,
      revertIfIncomplete,
      ethBalanceBefore
    );

    // Cannot use pre-existing ETH balance
    uint256 ethBalanceAfter = address(this).balance;
    if (ethBalanceAfter < ethBalanceBefore) {
        LibNFTOrdersRichErrors.OverspentEthError(
            msg.value + (ethBalanceBefore - ethBalanceAfter),
            msg.value
        ).rrevert();
    }

    // Refund
    _transferEth(msg.sender, ethBalanceAfter - ethBalanceBefore);
  }

  /// @dev Swaps tokens as instructed in `swapDetails` and
  ///      fills the sell order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param swapDetails The swap details required to fill
  ///        the given order.
  function swapAndBuyNFT(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    uint128 nftBuyAmount,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails
  ) public payable override {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);

    // Transfers tokens from `msg.sender` and swaps for ETH
    uint256 wethAvailable;
    for (uint256 i = 0; i < swapDetails.length; i++) {
      require(
        swapDetails[i].path[swapDetails[i].path.length - 1] == address(WETH),
        "swapAndBuyNFT::INVALID_SWAP_DETAILS"
      );

      if (swapDetails[i].path.length == 1) {
        _transferERC20TokensFrom(
          WETH,
          msg.sender,
          address(this),
          swapDetails[i].amountOut
        );
      } else {
        _transferFromAndSwapTokensForExactTokens(
          msg.sender,
          swapDetails[i].amountOut,
          swapDetails[i].amountInMax,
          swapDetails[i].path,
          address(this)
        );
      }

      wethAvailable = wethAvailable.safeAdd(swapDetails[i].amountOut);
    }
    WETH.withdraw(wethAvailable);

    _buyNFT(
      sellOrder,
      signature,
      BuyParams(
        nftBuyAmount,
        wethAvailable + msg.value
      )
    );

    uint256 ethBalanceAfter = address(this).balance;
    // Cannot use pre-existing ETH balance
    if (ethBalanceAfter < ethBalanceBefore) {
      LibNFTOrdersRichErrors
        .OverspentEthError(
          msg.value + (ethBalanceBefore - ethBalanceAfter),
          msg.value
        )
        .rrevert();
    }

    // Refund
    _transferEth(msg.sender, ethBalanceAfter - ethBalanceBefore);
  }

  /// @dev Performs the swaps instructed in `swapDetails` to
  ///      fill the given sell orders.
  /// @param sellOrders The NFT sell orders.
  /// @param signatures The order signatures.
  /// @param nftBuyAmounts The amount of the NFT asset to buy.
  /// @param swapDetails The swap details required to fill the orders.
  /// @param revertIfIncomplete If true, reverts if this
  ///        function fails to fill any individual order.
  /// @return successes An array of booleans corresponding to whether
  ///         each order in `orders` was successfully filled.
  function swapAndBuyNFTs(
    LibShoyuNFTOrder.NFTOrder[] memory sellOrders,
    LibSignature.Signature[] memory signatures,
    uint128[] memory nftBuyAmounts,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails,
    bool revertIfIncomplete
  ) public payable override returns (bool[] memory successes) {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);

    // Transfers tokens from `msg.sender` and swaps for ETH
    uint256 wethAvailable;
    for (uint256 i = 0; i < swapDetails.length; i++) {
      require(
        swapDetails[i].path[swapDetails[i].path.length - 1] == address(WETH),
        "sellAndSwapNFT::TOKEN_MISMATCH"
      );

      if (swapDetails[i].path.length == 1) {
       _transferERC20TokensFrom(
          WETH,
          msg.sender,
          address(this),
          swapDetails[i].amountOut
        );
      } else {
        _transferFromAndSwapTokensForExactTokens(
          msg.sender,
          swapDetails[i].amountOut,
          swapDetails[i].amountInMax,
          swapDetails[i].path,
          address(this)
        );
      }
      wethAvailable = wethAvailable.safeAdd(swapDetails[i].amountOut);
    }
    WETH.withdraw(wethAvailable);

    successes = _buyNFTs(
      sellOrders,
      signatures,
      nftBuyAmounts,
      revertIfIncomplete,
      ethBalanceBefore
    );
    
    // Cannot use pre-existing ETH balance
    uint256 ethBalanceAfter = address(this).balance;
    if (ethBalanceAfter < ethBalanceBefore) {
        LibNFTOrdersRichErrors.OverspentEthError(
            msg.value + (ethBalanceBefore - ethBalanceAfter),
            msg.value
        ).rrevert();
    }

    // Refund
    _transferEth(msg.sender, ethBalanceAfter - ethBalanceBefore);
  }

  // Core settlement logic for buying an NFT asset.
  function _buyNFT(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    BuyParams memory params
  ) public payable returns (uint256 erc20FillAmount) {
    LibShoyuNFTOrder.OrderInfo memory orderInfo = _getNFTOrderInfo(sellOrder);
    // Check that the order can be filled.
    _validateSellOrder(sellOrder, signature, orderInfo, msg.sender);

    if (params.buyAmount > orderInfo.remainingAmount) {
      LibNFTOrdersRichErrors
        .ExceedsRemainingOrderAmount(
          orderInfo.remainingAmount,
          params.buyAmount
        )
        .rrevert();
    }

    _updateOrderState(orderInfo.orderHash, params.buyAmount);

    if (params.buyAmount == orderInfo.orderAmount) {
      erc20FillAmount = sellOrder.erc20TokenAmount;
    } else {
      // Rounding favors the order maker.
      erc20FillAmount = LibMathV06.getPartialAmountCeil(
        params.buyAmount,
        orderInfo.orderAmount,
        sellOrder.erc20TokenAmount
      );
    }

    // Transfer the NFT asset to the buyer (`msg.sender`).
    _transferNFTAssetFrom(
      sellOrder.nftStandard,
      sellOrder.nftToken,
      sellOrder.maker,
      msg.sender,
      sellOrder.nftTokenId,
      params.buyAmount
    );

    _transferEth(payable(sellOrder.maker), erc20FillAmount);

    // Fees are paid from the EP's current balance of ETH.
    _payEthFees(
      sellOrder,
      params.buyAmount,
      orderInfo.orderAmount,
      erc20FillAmount,
      params.ethAvailable
    );

    emit NFTOrderFilled(
      sellOrder.direction,
      sellOrder.maker,
      msg.sender,
      sellOrder.nonce,
      sellOrder.erc20Token,
      sellOrder.erc20TokenAmount,
      sellOrder.nftToken,
      sellOrder.nftTokenId,
      params.buyAmount
    );
  }

  // Logic for batch filling sell orders
  function _buyNFTs(
    LibShoyuNFTOrder.NFTOrder[] memory sellOrders,
    LibSignature.Signature[] memory signatures,
    uint128[] memory nftBuyAmounts,
    bool revertIfIncomplete,
    uint256 ethBalanceBefore
  ) internal returns (bool[] memory successes) {
    require(
      sellOrders.length == signatures.length &&
      sellOrders.length == nftBuyAmounts.length,
      "_buyNFTs/ARRAY_LENGTH_MISMATCH"
    );

    successes = new bool[](sellOrders.length);

    if (revertIfIncomplete) {
      for (uint256 i = 0; i < sellOrders.length; i++) {
        // Will revert if _buyNFT reverts.
        _buyNFT(
          sellOrders[i],
          signatures[i],
          BuyParams(
            nftBuyAmounts[i],
            address(this).balance.safeSub(ethBalanceBefore) // Remaining ETH available
          )
        );
      }
    } else {
      for (uint256 i = 0; i < sellOrders.length; i++) {
        // Delegatecall `_buyNFT` to catch swallow reverts while
        // preserving execution context.
        // Note that `_buyNFT` is a public function but should _not_
        // be registered in the Exchange Proxy.
        (successes[i], ) = _implementation.delegatecall(
          abi.encodeWithSelector(
            this._buyNFT.selector,
            sellOrders[i],
            signatures[i],
            BuyParams(
              nftBuyAmounts[i],
              address(this).balance.safeSub(ethBalanceBefore) // Remaining ETH available
            )
          )
        );
      }
    }
  }
}
