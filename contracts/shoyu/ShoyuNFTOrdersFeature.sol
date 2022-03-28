pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../0x/fixins/FixinERC721Spender.sol";
import "../0x/fixins/FixinERC1155Spender.sol";
import "../0x/migrations/LibMigrate.sol";
import "../0x/features/interfaces/IFeature.sol";
import "../0x/features/libs/LibSignature.sol";
import "../sushiswap/uniswapv2/interfaces/IUniswapV2Router02.sol";
import "./IShoyuNFTOrdersFeature.sol";
import "./LibShoyuNFTOrder.sol";
import "./ShoyuNFTOrders.sol";
import "./LibShoyuNFTOrdersStorage.sol";

/// @dev Feature for interacting with Shoyu NFT orders.
contract ShoyuNFTOrdersFeature is
  IFeature,
  IShoyuNFTOrdersFeature,
  FixinERC721Spender,
  FixinERC1155Spender,
  ShoyuNFTOrders
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;
  using LibShoyuNFTOrder for LibShoyuNFTOrder.NFTOrder;
  using LibShoyuNFTOrder for LibShoyuNFTOrder.SwapExactOutDetails;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuNFTOrders";
  /// @dev Version of this feature.
  uint256 public immutable override FEATURE_VERSION = _encodeVersion(1, 0, 0);

  constructor(
    address payable zeroExAddress,
    IEtherTokenV06 weth,
    IUniswapV2Router02 sushiswapRouter
  ) public ShoyuNFTOrders(zeroExAddress, weth, sushiswapRouter) {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.sellAndSwapNFT.selector);
    _registerFeatureFunction(this.buyAndSwapNFT.selector);
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
  ) internal view override {
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
  ) internal override {
    assert(amount == 1);
    _transferERC721AssetFrom(IERC721Token(token), from, to, tokenId);
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
  ) internal override {
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
    override
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
}
