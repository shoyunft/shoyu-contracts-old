pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../errors/LibNFTOrdersRichErrors.sol";
import "../../fixins/FixinCommon.sol";
import "../../fixins/FixinEIP712.sol";
import "../../fixins/FixinTokenSpender.sol";
import "../../migrations/LibMigrate.sol";
import "../../vendor/IFeeRecipient.sol";
import "../../vendor/ITakerCallback.sol";
import "../libs/LibSignature.sol";
import "../libs/LibNFTOrder.sol";
import "../../IZeroEx.sol";
import "../../../sushiswap/uniswapv2/interfaces/IUniswapV2Router02.sol";
import "./LibShoyuNFTOrder.sol";

/// @dev Abstract base contract inherited by ShoyuERC721OrdersFeature and ShoyuERC1155OrdersFeature
abstract contract ShoyuNFTOrders is
  FixinCommon,
  FixinEIP712,
  FixinTokenSpender
{
  using LibSafeMathV06 for uint256;

  /// @dev Native token pseudo-address.
  address internal constant NATIVE_TOKEN_ADDRESS =
    0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  /// @dev The WETH token contract.
  IEtherTokenV06 internal immutable WETH;

  /// @dev The magic return value indicating the success of a `receiveZeroExFeeCallback`.
  bytes4 private constant FEE_CALLBACK_MAGIC_BYTES =
    IFeeRecipient.receiveZeroExFeeCallback.selector;
  /// @dev The magic return value indicating the success of a `zeroExTakerCallback`.
  bytes4 private constant TAKER_CALLBACK_MAGIC_BYTES =
    ITakerCallback.zeroExTakerCallback.selector;

  /// @dev The Sushiswap router contract;
  IUniswapV2Router02 internal immutable SushiswapRouter;

  constructor(
    address payable zeroExAddress,
    IEtherTokenV06 weth,
    IUniswapV2Router02 sushiswapRouter
  ) public FixinEIP712(zeroExAddress) {
    WETH = weth;
    SushiswapRouter = sushiswapRouter;
  }

  struct SellAndSwapParams {
    uint128 sellAmount;
    uint256 tokenId;
    bool unwrapNativeToken;
    address taker;
    address currentNftOwner;
    bytes takerCallbackData;
    IERC20TokenV06 outputToken;
    uint256 minAmountOut;
  }

  struct BuyAndSwapParams {
    uint128 buyAmount;
    uint256 ethAvailable;
    bytes takerCallbackData;
    LibShoyuNFTOrder.SwapExactOutDetails[] swapDetails;
  }

  function _sellAndSwapNFT(
    LibNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    SellAndSwapParams memory params
  ) internal returns (uint256 erc20FillAmount) {
    // Output token must be different than buyOrder.erc20Token
    require(
      params.outputToken != buyOrder.erc20Token,
      "ShoyuNFTOrders::_sellAndSwapNFT/SAME_TOKEN"
    );

    LibNFTOrder.OrderInfo memory orderInfo = _getOrderInfo(buyOrder);
    // Check that the order can be filled.
    _validateBuyOrder(
      buyOrder,
      signature,
      orderInfo,
      params.taker,
      params.tokenId
    );

    if (params.sellAmount > orderInfo.remainingAmount) {
      LibNFTOrdersRichErrors
        .ExceedsRemainingOrderAmount(
          orderInfo.remainingAmount,
          params.sellAmount
        )
        .rrevert();
    }

    _updateOrderState(buyOrder, orderInfo.orderHash, params.sellAmount);

    // TODO: what is this?
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

    // Transfer the ERC20 from the maker to the Exchange Proxy
    // so we can swap it before sending it to the seller.
    // TODO: Probably safe to just use ERC20.transferFrom for some
    //       small gas savings
    _transferERC20TokensFrom(
      buyOrder.erc20Token,
      buyOrder.maker,
      address(this),
      erc20FillAmount
    );

    buyOrder.erc20Token.approve(address(SushiswapRouter), erc20FillAmount);
    address[] memory path = new address[](2);
    path[0] = address(buyOrder.erc20Token);
    path[1] = address(params.outputToken);

    if (params.unwrapNativeToken) {
      if (params.outputToken != WETH) {
        LibNFTOrdersRichErrors
          .ERC20TokenMismatchError(address(params.outputToken), address(WETH))
          .rrevert();
      }
      SushiswapRouter.swapExactTokensForETH(
        erc20FillAmount,
        params.minAmountOut,
        path,
        params.taker,
        buyOrder.expiry
      );
    } else {
      SushiswapRouter.swapExactTokensForTokens(
        erc20FillAmount,
        0,
        path,
        params.taker,
        buyOrder.expiry
      );
    }

    if (params.takerCallbackData.length > 0) {
      require(
        params.taker != address(this),
        "ShoyuNFTOrders::_sellNFT/CANNOT_CALLBACK_SELF"
      );
      // Invoke the callback
      bytes4 callbackResult = ITakerCallback(params.taker).zeroExTakerCallback(
        orderInfo.orderHash,
        params.takerCallbackData
      );
      // Check for the magic success bytes
      require(
        callbackResult == TAKER_CALLBACK_MAGIC_BYTES,
        "ShoyuNFTOrders::_sellNFT/CALLBACK_FAILED"
      );
    }

    // Transfer the NFT asset to the buyer.
    // If this function is called from the
    // `onNFTReceived` callback the Exchange Proxy
    // holds the asset. Otherwise, transfer it from
    // the seller.
    _transferNFTAssetFrom(
      buyOrder.nft,
      params.currentNftOwner,
      buyOrder.maker,
      params.tokenId,
      params.sellAmount
    );

    // The buyer pays the order fees.
    // _payFees(
    //     buyOrder,
    //     buyOrder.maker,
    //     params.sellAmount,
    //     orderInfo.orderAmount,
    //     false
    // );
  }

  function _swapMultipleTokensForETH(
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails,
    uint256 expiry
  ) internal returns (uint256 amountOut) {
    amountOut = 0;

    for (uint256 i = 0; i < swapDetails.length; i++) {
      uint256[] memory amounts = SushiswapRouter.getAmountsIn(
        swapDetails[i].amountOut,
        swapDetails[i].path
      );

      require(
        amounts[0] <= swapDetails[i].maxAmountIn,
        "ShoyuNFTOrders::_buyAndSwapNFT/INSUFFICIENT_FUNDS"
      );

      // Transfer the ERC20 from the maker to the Exchange Proxy
      // so we can swap it before sending it to the seller.
      // TODO: Probably safe to just use ERC20.transferFrom for some
      //       small gas savings
      _transferERC20TokensFrom(
        IERC20TokenV06(swapDetails[i].path[0]),
        msg.sender,
        address(this),
        amounts[0]
      );

      IERC20TokenV06(swapDetails[i].path[0]).approve(
        address(SushiswapRouter),
        amounts[0]
      );

      SushiswapRouter.swapTokensForExactETH(
        swapDetails[i].amountOut,
        swapDetails[i].maxAmountIn,
        swapDetails[i].path,
        address(this),
        expiry
      );

      amountOut = amountOut.safeAdd(amounts[amounts.length - 1]);
    }
  }

  // Core settlement logic for buying an NFT asset.
  function _buyAndSwapNFT(
    LibNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    BuyAndSwapParams memory params
  ) internal returns (uint256 erc20FillAmount) {
    LibNFTOrder.OrderInfo memory orderInfo = _getOrderInfo(sellOrder);
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

    _updateOrderState(sellOrder, orderInfo.orderHash, params.buyAmount);

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
      sellOrder.nft,
      sellOrder.maker,
      msg.sender,
      sellOrder.nftId,
      params.buyAmount
    );

    uint256 ethAvailable = params.ethAvailable;
    if (params.takerCallbackData.length > 0) {
      require(
        msg.sender != address(this),
        "ShoyuNFTOrders::_buyAndSwapNFT/CANNOT_CALLBACK_SELF"
      );
      uint256 ethBalanceBeforeCallback = address(this).balance;
      // Invoke the callback
      bytes4 callbackResult = ITakerCallback(msg.sender).zeroExTakerCallback(
        orderInfo.orderHash,
        params.takerCallbackData
      );
      // Update `ethAvailable` with amount acquired during
      // the callback
      ethAvailable = ethAvailable.safeAdd(
        address(this).balance.safeSub(ethBalanceBeforeCallback)
      );
      // Check for the magic success bytes
      require(
        callbackResult == TAKER_CALLBACK_MAGIC_BYTES,
        "ShoyuNFTOrders::_buyAndSwapNFT/CALLBACK_FAILED"
      );
    }

    require(
      _swapMultipleTokensForETH(params.swapDetails, sellOrder.expiry) ==
        erc20FillAmount,
      "ShoyuNFTOrders::_buyAndSwapNFT/INVALID_SWAP_PARAMS"
    );

    _transferEth(payable(sellOrder.maker), erc20FillAmount);

    // The buyer pays fees using ETH.
    // _payFees(
    //     sellOrder,
    //     msg.sender,
    //     params.buyAmount,
    //     orderInfo.orderAmount,
    //     false
    // );
  }

  function _validateSellOrder(
    LibNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    LibNFTOrder.OrderInfo memory orderInfo,
    address taker
  ) internal view {
    // Order must be selling the NFT asset.
    require(
      sellOrder.direction == LibNFTOrder.TradeDirection.SELL_NFT,
      "ShoyuNFTOrders::_validateSellOrder/WRONG_TRADE_DIRECTION"
    );
    // Sell order must be fillable with NATIVE_TOKEN
    require(
      address(sellOrder.erc20Token) == NATIVE_TOKEN_ADDRESS,
      "ShoyuNFTOrders::_validateSellOrder/NOT_NATIVE_TOKEN"
    );
    // Taker must match the order taker, if one is specified.
    if (sellOrder.taker != address(0) && sellOrder.taker != taker) {
      LibNFTOrdersRichErrors.OnlyTakerError(taker, sellOrder.taker).rrevert();
    }
    // Check that the order is valid and has not expired, been cancelled,
    // or been filled.
    if (orderInfo.status != LibNFTOrder.OrderStatus.FILLABLE) {
      LibNFTOrdersRichErrors
        .OrderNotFillableError(
          sellOrder.maker,
          sellOrder.nonce,
          uint8(orderInfo.status)
        )
        .rrevert();
    }

    // Check the signature.
    _validateOrderSignature(orderInfo.orderHash, signature, sellOrder.maker);
  }

  function _validateBuyOrder(
    LibNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    LibNFTOrder.OrderInfo memory orderInfo,
    address taker,
    uint256 tokenId
  ) internal view {
    // Order must be buying the NFT asset.
    require(
      buyOrder.direction == LibNFTOrder.TradeDirection.BUY_NFT,
      "ShoyuNFTOrders::_validateBuyOrder/WRONG_TRADE_DIRECTION"
    );
    // The ERC20 token cannot be ETH.
    require(
      address(buyOrder.erc20Token) != NATIVE_TOKEN_ADDRESS,
      "ShoyuNFTOrders::_validateBuyOrder/NATIVE_TOKEN_NOT_ALLOWED"
    );
    // Taker must match the order taker, if one is specified.
    if (buyOrder.taker != address(0) && buyOrder.taker != taker) {
      LibNFTOrdersRichErrors.OnlyTakerError(taker, buyOrder.taker).rrevert();
    }
    // Check that the order is valid and has not expired, been cancelled,
    // or been filled.
    if (orderInfo.status != LibNFTOrder.OrderStatus.FILLABLE) {
      LibNFTOrdersRichErrors
        .OrderNotFillableError(
          buyOrder.maker,
          buyOrder.nonce,
          uint8(orderInfo.status)
        )
        .rrevert();
    }
    // Check that the asset with the given token ID satisfies the properties
    // specified by the order.
    _validateOrderProperties(buyOrder, tokenId);
    // Check the signature.
    _validateOrderSignature(orderInfo.orderHash, signature, buyOrder.maker);
  }

  function _payEthFees(
    LibNFTOrder.NFTOrder memory order,
    uint128 fillAmount,
    uint128 orderAmount,
    uint256 ethSpent,
    uint256 ethAvailable
  ) private {
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
    if (ethSpent > ethAvailable) {
      LibNFTOrdersRichErrors.OverspentEthError(ethSpent, ethAvailable).rrevert();
    }
  }

  function _payFees(
    LibNFTOrder.NFTOrder memory order,
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
          address(order.erc20Token) == NATIVE_TOKEN_ADDRESS
      );
    }

    for (uint256 i = 0; i < order.fees.length; i++) {
      LibNFTOrder.Fee memory fee = order.fees[i];

      require(
        fee.recipient != address(this),
        "ShoyuNFTOrders::_payFees/RECIPIENT_CANNOT_BE_EXCHANGE_PROXY"
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
      // Note that the fee callback is _not_ called if zero
      // `feeData` is provided. If `feeData` is provided, we assume
      // the fee recipient is a contract that implements the
      // `IFeeRecipient` interface.
      if (fee.feeData.length > 0) {
        // Invoke the callback
        bytes4 callbackResult = IFeeRecipient(fee.recipient)
          .receiveZeroExFeeCallback(
            useNativeToken ? NATIVE_TOKEN_ADDRESS : address(order.erc20Token),
            feeFillAmount,
            fee.feeData
          );
        // Check for the magic success bytes
        require(
          callbackResult == FEE_CALLBACK_MAGIC_BYTES,
          "ShoyuNFTOrders::_payFees/CALLBACK_FAILED"
        );
      }
      // Sum the fees paid
      totalFeesPaid = totalFeesPaid.safeAdd(feeFillAmount);
    }
  }

  /// @dev If the given order is buying an NFT asset, checks
  ///      whether or not the given token ID satisfies the required
  ///      properties specified in the order. If the order does not
  ///      specify any properties, this function instead checks
  ///      whether the given token ID matches the ID in the order.
  ///      Reverts if any checks fail, or if the order is selling
  ///      an NFT asset.
  /// @param order The NFT order.
  /// @param tokenId The ID of the NFT asset.
  function _validateOrderProperties(
    LibNFTOrder.NFTOrder memory order,
    uint256 tokenId
  ) internal view {
    // Order must be buying an NFT asset to have properties.
    require(
      order.direction == LibNFTOrder.TradeDirection.BUY_NFT,
      "ShoyuNFTOrders::_validateOrderProperties/WRONG_TRADE_DIRECTION"
    );

    // If no properties are specified, check that the given
    // `tokenId` matches the one specified in the order.
    if (order.nftProperties.length == 0) {
      if (tokenId != order.nftId) {
        LibNFTOrdersRichErrors
          .TokenIdMismatchError(tokenId, order.nftId)
          .rrevert();
      }
    } else {
      // Validate each property
      for (uint256 i = 0; i < order.nftProperties.length; i++) {
        LibNFTOrder.Property memory property = order.nftProperties[i];
        // `address(0)` is interpreted as a no-op. Any token ID
        // will satisfy a property with `propertyValidator == address(0)`.
        if (address(property.propertyValidator) == address(0)) {
          continue;
        }

        // Call the property validator and throw a descriptive error
        // if the call reverts.
        try
          property.propertyValidator.validateProperty(
            order.nft,
            tokenId,
            property.propertyData
          )
        {} catch (bytes memory errorData) {
          LibNFTOrdersRichErrors
            .PropertyValidationFailedError(
              address(property.propertyValidator),
              order.nft,
              tokenId,
              property.propertyData,
              errorData
            )
            .rrevert();
        }
      }
    }
  }

  /// @dev Validates that the given signature is valid for the
  ///      given maker and order hash. Reverts if the signature
  ///      is not valid.
  /// @param orderHash The hash of the order that was signed.
  /// @param signature The signature to check.
  /// @param maker The maker of the order.
  function _validateOrderSignature(
    bytes32 orderHash,
    LibSignature.Signature memory signature,
    address maker
  ) internal view virtual;

  /// @dev Transfers an NFT asset.
  /// @param token The address of the NFT contract.
  /// @param from The address currently holding the asset.
  /// @param to The address to transfer the asset to.
  /// @param tokenId The ID of the asset to transfer.
  /// @param amount The amount of the asset to transfer. Always
  ///        1 for ERC721 assets.
  function _transferNFTAssetFrom(
    address token,
    address from,
    address to,
    uint256 tokenId,
    uint256 amount
  ) internal virtual;

  /// @dev Updates storage to indicate that the given order
  ///      has been filled by the given amount.
  /// @param order The order that has been filled.
  /// @param orderHash The hash of `order`.
  /// @param fillAmount The amount (denominated in the NFT asset)
  ///        that the order has been filled by.
  function _updateOrderState(
    LibNFTOrder.NFTOrder memory order,
    bytes32 orderHash,
    uint128 fillAmount
  ) internal virtual;

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function _getOrderInfo(LibNFTOrder.NFTOrder memory order)
    internal
    view
    virtual
    returns (LibNFTOrder.OrderInfo memory orderInfo);
}
