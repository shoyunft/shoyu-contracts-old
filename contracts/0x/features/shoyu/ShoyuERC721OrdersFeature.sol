pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "../../fixins/FixinERC721Spender.sol";
import "../../migrations/LibMigrate.sol";
import "../../storage/LibERC721OrdersStorage.sol";
import "../interfaces/IFeature.sol";
import "../interfaces/IERC721OrdersFeature.sol";
import "../libs/LibNFTOrder.sol";
import "../libs/LibSignature.sol";
import "./ShoyuNFTOrders.sol";
import "../../../sushiswap/uniswapv2/interfaces/IUniswapV2Router02.sol";

/// @dev Feature for interacting with ERC721 orders.
contract ShoyuERC721OrdersFeature is
  IFeature,
  IShoyuERC721OrdersFeature,
  FixinERC721Spender,
  ShoyuNFTOrders
{
  using LibSafeMathV06 for uint256;
  using LibNFTOrder for LibNFTOrder.ERC721Order;
  using LibNFTOrder for LibNFTOrder.NFTOrder;

  /// @dev Name of this feature.
  string public constant override FEATURE_NAME = "ShoyuERC721Orders";
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
    _registerFeatureFunction(this.sellAndSwapERC721.selector);
    _registerFeatureFunction(this.buyAndSwapERC721.selector);
    return LibMigrate.MIGRATE_SUCCESS;
  }

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
  /// @param outputToken The address of the ERC20 token the seller
  ///        would like to receive
  function sellAndSwapERC721(
    LibNFTOrder.ERC721Order memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 erc721TokenId,
    bool unwrapNativeToken,
    bytes memory callbackData,
    IERC20TokenV06 outputToken,
    uint256 minAmountOut
  ) public override {
    _sellAndSwapERC721(
      buyOrder,
      signature,
      erc721TokenId,
      unwrapNativeToken,
      msg.sender, // taker
      msg.sender, // owner
      callbackData,
      outputToken,
      minAmountOut
    );
  }

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
    LibNFTOrder.ERC721Order memory sellOrder,
    LibSignature.Signature memory signature,
    bytes memory callbackData,
    IERC20TokenV06 inputToken,
    uint256 maxAmountIn
  ) public payable override {
    uint256 ethBalanceBefore = address(this).balance.safeSub(msg.value);
    _buyAndSwapERC721(
      sellOrder,
      signature,
      msg.value,
      callbackData,
      inputToken,
      maxAmountIn
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

  // Core settlement logic for selling an ERC721 asset.
  // Used by `sellERC721` and `onERC721Received`.
  function _sellAndSwapERC721(
    LibNFTOrder.ERC721Order memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 erc721TokenId,
    bool unwrapNativeToken,
    address taker,
    address currentNftOwner,
    bytes memory takerCallbackData,
    IERC20TokenV06 outputToken,
    uint256 minAmountOut
  ) private {
    _sellAndSwapNFT(
      buyOrder.asNFTOrder(),
      signature,
      SellAndSwapParams(
        1, // sell amount
        erc721TokenId,
        unwrapNativeToken,
        taker,
        currentNftOwner,
        takerCallbackData,
        outputToken,
        minAmountOut
      )
    );

    emit ERC721OrderFilled(
      buyOrder.direction,
      buyOrder.maker,
      taker,
      buyOrder.nonce,
      buyOrder.erc20Token,
      buyOrder.erc20TokenAmount,
      buyOrder.erc721Token,
      erc721TokenId,
      address(0)
    );
  }

  // Core settlement logic for buying an ERC721 asset.
  function _buyAndSwapERC721(
    LibNFTOrder.ERC721Order memory sellOrder,
    LibSignature.Signature memory signature,
    uint256 ethAvailable,
    bytes memory takerCallbackData,
    IERC20TokenV06 inputToken,
    uint256 maxAmountIn
  ) public payable {
    _buyAndSwapNFT(
      sellOrder.asNFTOrder(),
      signature,
      BuyAndSwapParams(
        1, // buy amount
        ethAvailable,
        takerCallbackData,
        inputToken,
        maxAmountIn
      )
    );

    emit ERC721OrderFilled(
      sellOrder.direction,
      sellOrder.maker,
      msg.sender,
      sellOrder.nonce,
      sellOrder.erc20Token,
      sellOrder.erc20TokenAmount,
      sellOrder.erc721Token,
      sellOrder.erc721TokenId,
      address(0)
    );
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
      bool isPreSigned = LibERC721OrdersStorage.getStorage().preSigned[
        orderHash
      ];
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
  /// @param order The order that has been filled.
  /// @param fillAmount The amount (denominated in the NFT asset)
  ///        that the order has been filled by.
  function _updateOrderState(
    LibNFTOrder.NFTOrder memory order,
    bytes32, /* orderHash */
    uint128 fillAmount
  ) internal override {
    assert(fillAmount == 1);
    _setOrderStatusBit(order.maker, order.nonce);
  }

  function _setOrderStatusBit(address maker, uint256 nonce) private {
    // The bitvector is indexed by the lower 8 bits of the nonce.
    uint256 flag = 1 << (nonce & 255);
    // Update order status bit vector to indicate that the given order
    // has been cancelled/filled by setting the designated bit to 1.
    LibERC721OrdersStorage.getStorage().orderStatusByMaker[maker][
      uint248(nonce >> 8)
    ] |= flag;
  }

  /// @dev Get the order info for an NFT order.
  /// @param order The NFT order.
  /// @return orderInfo Info about the order.
  function _getOrderInfo(LibNFTOrder.NFTOrder memory order)
    internal
    view
    override
    returns (LibNFTOrder.OrderInfo memory orderInfo)
  {
    LibNFTOrder.ERC721Order memory erc721Order = order.asERC721Order();
    orderInfo.orderHash = getERC721OrderHash(erc721Order);
    orderInfo.status = getERC721OrderStatus(erc721Order);
    orderInfo.orderAmount = 1;
    orderInfo.remainingAmount = orderInfo.status ==
      LibNFTOrder.OrderStatus.FILLABLE
      ? 1
      : 0;
  }

  /// @dev Get the current status of an ERC721 order.
  /// @param order The ERC721 order.
  /// @return status The status of the order.
  function getERC721OrderStatus(LibNFTOrder.ERC721Order memory order)
    public
    view
    returns (LibNFTOrder.OrderStatus status)
  {
    // Only buy orders with `erc721TokenId` == 0 can be property
    // orders.
    if (
      order.erc721TokenProperties.length > 0 &&
      (order.direction != LibNFTOrder.TradeDirection.BUY_NFT ||
        order.erc721TokenId != 0)
    ) {
      return LibNFTOrder.OrderStatus.INVALID;
    }

    // Buy orders cannot use ETH as the ERC20 token, since ETH cannot be
    // transferred from the buyer by a contract.
    if (
      order.direction == LibNFTOrder.TradeDirection.BUY_NFT &&
      address(order.erc20Token) == NATIVE_TOKEN_ADDRESS
    ) {
      return LibNFTOrder.OrderStatus.INVALID;
    }

    // Check for expiry.
    if (order.expiry <= block.timestamp) {
      return LibNFTOrder.OrderStatus.EXPIRED;
    }

    // Check `orderStatusByMaker` state variable to see if the order
    // has been cancelled or previously filled.
    LibERC721OrdersStorage.Storage storage stor = LibERC721OrdersStorage
      .getStorage();
    // `orderStatusByMaker` is indexed by maker and nonce.
    uint256 orderStatusBitVector = stor.orderStatusByMaker[order.maker][
      uint248(order.nonce >> 8)
    ];
    // The bitvector is indexed by the lower 8 bits of the nonce.
    uint256 flag = 1 << (order.nonce & 255);
    // If the designated bit is set, the order has been cancelled or
    // previously filled, so it is now unfillable.
    if (orderStatusBitVector & flag != 0) {
      return LibNFTOrder.OrderStatus.UNFILLABLE;
    }

    // Otherwise, the order is fillable.
    return LibNFTOrder.OrderStatus.FILLABLE;
  }

  /// @dev Get the EIP-712 hash of an ERC721 order.
  /// @param order The ERC721 order.
  /// @return orderHash The order hash.
  function getERC721OrderHash(LibNFTOrder.ERC721Order memory order)
    public
    view
    returns (bytes32 orderHash)
  {
    return _getEIP712Hash(LibNFTOrder.getERC721OrderStructHash(order));
  }
}
