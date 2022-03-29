pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../0x/migrations/LibMigrate.sol";
import "../0x/features/interfaces/IFeature.sol";
import "../0x/features/libs/LibSignature.sol";
import "../0x/fixins/FixinCommon.sol";
import "../0x/fixins/FixinEIP712.sol";
import "../0x/fixins/FixinTokenSpender.sol";
import "../0x/fixins/FixinERC721Spender.sol";
import "../0x/fixins/FixinERC1155Spender.sol";
import "../0x/vendor/IFeeRecipient.sol";
import "../0x/vendor/ITakerCallback.sol";
import "../0x/errors/LibNFTOrdersRichErrors.sol";
import "../sushiswap/uniswapv2/interfaces/IUniswapV2Router02.sol";
import "./IShoyuNFTOrdersFeature.sol";
import "./LibShoyuNFTOrder.sol";
import "./LibShoyuNFTOrdersStorage.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTOrdersFeature is
  IFeature,
  IShoyuNFTOrdersFeature,
  FixinCommon,
  FixinEIP712,
  FixinTokenSpender,
  FixinERC721Spender,
  FixinERC1155Spender
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;
  using LibShoyuNFTOrder for LibShoyuNFTOrder.NFTOrder;
  using LibShoyuNFTOrder for LibShoyuNFTOrder.SwapExactOutDetails;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

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
    IERC20TokenV06 outputToken;
    uint256 minAmountOut;
  }

  struct BuyAndSwapParams {
    uint128 buyAmount;
    uint256 ethAvailable;
    LibShoyuNFTOrder.SwapExactOutDetails[] swapDetails;
  }

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.sellAndSwapNFT.selector);
    _registerFeatureFunction(this.buyAndSwapNFT.selector);
    _registerFeatureFunction(this.buyAndSwapNFTs.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }

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
  /// @param outputToken The address of the ERC20 token the seller
  ///        would like to receive
  /// @param minAmountOut The minimum amount of outputToken received
  function sellAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 nftTokenId,
    bool unwrapNativeToken,
    IERC20TokenV06 outputToken,
    uint256 minAmountOut
  ) public override {
    _sellAndSwapNFT(
      buyOrder,
      signature,
      SellAndSwapParams(
        buyOrder.nftTokenAmount,
        nftTokenId,
        unwrapNativeToken,
        msg.sender, //taker
        msg.sender, // owner
        outputToken,
        minAmountOut
      )
    );

    emit NFTOrderFilled(
      buyOrder.direction,
      buyOrder.maker,
      msg.sender,
      buyOrder.nonce,
      buyOrder.erc20Token,
      buyOrder.erc20TokenAmount,
      buyOrder.nftToken,
      nftTokenId,
      buyOrder.nftTokenAmount
    );
  }

  /// @dev Buys an NFT asset by filling the given order.
  /// @param sellOrder The NFT sell order.
  /// @param signature The order signature.
  /// @param swapDetails The swap details required to fill
  ///        the given order.
  function buyAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    uint128 nftBuyAmount,
    LibShoyuNFTOrder.SwapExactOutDetails[] memory swapDetails
  ) public payable override {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);
    _buyAndSwapNFT(
      sellOrder,
      signature,
      BuyAndSwapParams(nftBuyAmount, msg.value, swapDetails)
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
      nftBuyAmount
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

  function _sellAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    SellAndSwapParams memory params
  ) internal returns (uint256 erc20FillAmount) {
    // Output token must be different than buyOrder.erc20Token
    require(
      params.outputToken != buyOrder.erc20Token,
      "ShoyuNFTOrders::_sellAndSwapNFT/SAME_TOKEN"
    );

    LibShoyuNFTOrder.OrderInfo memory orderInfo = _getOrderInfo(buyOrder);
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
  }

  // Core settlement logic for buying an NFT asset.
  function _buyAndSwapNFT(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    BuyAndSwapParams memory params
  ) internal returns (uint256 erc20FillAmount) {
    LibShoyuNFTOrder.OrderInfo memory orderInfo = _getOrderInfo(sellOrder);
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
      sellOrder.nftStandard,
      sellOrder.nftToken,
      sellOrder.maker,
      msg.sender,
      sellOrder.nftTokenId,
      params.buyAmount
    );

    require(
      _swapMultipleTokensForETH(params.swapDetails, sellOrder.expiry) ==
        erc20FillAmount,
      "ShoyuNFTOrders::_buyAndSwapNFT/INVALID_SWAP_PARAMS"
    );

    _transferEth(payable(sellOrder.maker), erc20FillAmount);

    // The buyer pays fees using ETH.
    _payFees(
        sellOrder,
        msg.sender,
        params.buyAmount,
        orderInfo.orderAmount,
        false
    );
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
  ) internal view {
    if (signature.signatureType == LibSignature.SignatureType.PRESIGNED) {
      // Check if order hash has been pre-signed by the maker.
      bool isPreSigned = LibShoyuNFTOrdersStorage
        .getStorage()
        .orderState[orderHash]
        .preSigned;
      if (!isPreSigned) {
        LibNFTOrdersRichErrors.InvalidSignerError(maker, address(0)).rrevert();
      }
    } else {
      address signer = LibSignature.getSignerOfHash(orderHash, signature);
      if (signer != maker) {
        LibNFTOrdersRichErrors.InvalidSignerError(maker, signer).rrevert();
      }
    }
  }

  /// @dev Updates storage to indicate that the given order
  ///      has been filled by the given amount.
  /// @param orderHash The hash of `order`.
  /// @param fillAmount The amount (denominated in the NFT asset)
  ///        that the order has been filled by.
  function _updateOrderState(
    LibShoyuNFTOrder.NFTOrder memory, /* order */
    bytes32 orderHash,
    uint128 fillAmount
  ) internal {
    LibShoyuNFTOrdersStorage.Storage storage stor = LibShoyuNFTOrdersStorage
      .getStorage();
    uint128 filledAmount = stor.orderState[orderHash].filledAmount;
    // Filled amount should never overflow 128 bits
    assert(filledAmount + fillAmount > filledAmount);
    stor.orderState[orderHash].filledAmount = filledAmount + fillAmount;
  }

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function getNFTOrderInfo(LibShoyuNFTOrder.NFTOrder memory order)
    public
    view
    override
    returns (LibShoyuNFTOrder.OrderInfo memory orderInfo)
  {
    orderInfo.orderAmount = order.nftTokenAmount;
    orderInfo.orderHash = getNFTOrderHash(order);

    // Only buy orders with `nftTokenId` == 0 can be property
    // orders.
    if (
      order.nftTokenProperties.length > 0 &&
      (order.direction != LibShoyuNFTOrder.TradeDirection.BUY_NFT ||
        order.nftTokenId != 0)
    ) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.INVALID;
      return orderInfo;
    }

    // Buy orders cannot use ETH as the ERC20 token, since ETH cannot be
    // transferred from the buyer by a contract.
    if (
      order.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT &&
      address(order.erc20Token) == NATIVE_TOKEN_ADDRESS
    ) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.INVALID;
      return orderInfo;
    }

    // Check for expiry.
    if (order.expiry <= block.timestamp) {
      orderInfo.status = LibShoyuNFTOrder.OrderStatus.EXPIRED;
      return orderInfo;
    }

    {
      LibShoyuNFTOrdersStorage.Storage storage stor = LibShoyuNFTOrdersStorage
        .getStorage();

      LibShoyuNFTOrdersStorage.OrderState storage orderState = stor.orderState[
        orderInfo.orderHash
      ];
      orderInfo.remainingAmount = order.nftTokenAmount.safeSub128(
        orderState.filledAmount
      );

      // `orderCancellationByMaker` is indexed by maker and nonce.
      uint256 orderCancellationBitVector = stor.orderCancellationByMaker[
        order.maker
      ][uint248(order.nonce >> 8)];
      // The bitvector is indexed by the lower 8 bits of the nonce.
      uint256 flag = 1 << (order.nonce & 255);

      if (
        orderInfo.remainingAmount == 0 || orderCancellationBitVector & flag != 0
      ) {
        orderInfo.status = LibShoyuNFTOrder.OrderStatus.UNFILLABLE;
        return orderInfo;
      }
    }

    // Otherwise, the order is fillable.
    orderInfo.status = LibShoyuNFTOrder.OrderStatus.FILLABLE;
  }

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function _getOrderInfo(LibShoyuNFTOrder.NFTOrder memory order)
    internal
    view
    returns (LibShoyuNFTOrder.OrderInfo memory orderInfo)
  {
    return getNFTOrderInfo(order);
  }

  /// @dev Get the EIP-712 hash of an NFT order.
  /// @param order The NFT order.
  /// @return orderHash The order hash.
  function getNFTOrderHash(LibShoyuNFTOrder.NFTOrder memory order)
    public
    view
    override
    returns (bytes32 orderHash)
  {
    return _getEIP712Hash(LibShoyuNFTOrder.getNFTOrderStructHash(order));
  }

  function _validateSellOrder(
    LibShoyuNFTOrder.NFTOrder memory sellOrder,
    LibSignature.Signature memory signature,
    LibShoyuNFTOrder.OrderInfo memory orderInfo,
    address taker
  ) internal view {
    // Order must be selling the NFT asset.
    require(
      sellOrder.direction == LibShoyuNFTOrder.TradeDirection.SELL_NFT,
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
    if (orderInfo.status != LibShoyuNFTOrder.OrderStatus.FILLABLE) {
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
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    LibShoyuNFTOrder.OrderInfo memory orderInfo,
    address taker,
    uint256 tokenId
  ) internal view {
    // Order must be buying the NFT asset.
    require(
      buyOrder.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT,
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
    if (orderInfo.status != LibShoyuNFTOrder.OrderStatus.FILLABLE) {
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
    LibShoyuNFTOrder.NFTOrder memory order,
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
          address(order.erc20Token) == NATIVE_TOKEN_ADDRESS
      );
    }

    for (uint256 i = 0; i < order.fees.length; i++) {
      LibShoyuNFTOrder.Fee memory fee = order.fees[i];

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
    LibShoyuNFTOrder.NFTOrder memory order,
    uint256 tokenId
  ) internal view {
    // Order must be buying an NFT asset to have properties.
    require(
      order.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT,
      "ShoyuNFTOrders::_validateOrderProperties/WRONG_TRADE_DIRECTION"
    );

    // If no properties are specified, check that the given
    // `tokenId` matches the one specified in the order.
    if (order.nftTokenProperties.length == 0) {
      if (tokenId != order.nftTokenId) {
        LibNFTOrdersRichErrors
          .TokenIdMismatchError(tokenId, order.nftTokenId)
          .rrevert();
      }
    } else {
      // Validate each property
      for (uint256 i = 0; i < order.nftTokenProperties.length; i++) {
        LibShoyuNFTOrder.Property memory property = order.nftTokenProperties[i];
        // `address(0)` is interpreted as a no-op. Any token ID
        // will satisfy a property with `propertyValidator == address(0)`.
        if (address(property.propertyValidator) == address(0)) {
          continue;
        }

        // Call the property validator and throw a descriptive error
        // if the call reverts.
        try
          property.propertyValidator.validateProperty(
            order.nftToken,
            tokenId,
            property.propertyData
          )
        {} catch (bytes memory errorData) {
          LibNFTOrdersRichErrors
            .PropertyValidationFailedError(
              address(property.propertyValidator),
              order.nftToken,
              tokenId,
              property.propertyData,
              errorData
            )
            .rrevert();
        }
      }
    }
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
    uint256 amount
  ) internal {
    if (nftStandard == LibShoyuNFTOrder.NFTStandard.ERC721) {
      assert (amount == 1);
      _transferERC721AssetFrom(IERC721Token(token), from, to, tokenId);
    } else {
      _transferERC1155AssetFrom(IERC1155Token(token), from, to, tokenId, amount);
    }
  }
}
