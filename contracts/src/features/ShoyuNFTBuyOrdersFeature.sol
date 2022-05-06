pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-zero-ex/contracts/src/migrations/LibMigrate.sol";
import "@0x/contracts-zero-ex/contracts/src/features/interfaces/IFeature.sol";
import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinCommon.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinTokenSpender.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "../interfaces/IShoyuNFTBuyOrdersFeature.sol";
import "../interfaces/IShoyuNFTOrderEvents.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "../libraries/LibShoyuNFTOrdersStorage.sol";
import "../libraries/LibShoyuNFTOrdersRichErrors.sol";
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

  /// @dev The magic return value indicating the success of a `onERC721Received`.
  bytes4 private constant ERC721_RECEIVED_MAGIC_BYTES = this.onERC721Received.selector;
  /// @dev The magic return value indicating the success of a `onERC1155Received`.
  bytes4 private constant ERC1155_RECEIVED_MAGIC_BYTES = this.onERC1155Received.selector;

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
    ShoyuNFTBuyOrders(_zeroExAddress, _weth)
    ShoyuSpender(_weth)
    ShoyuSwapper(_factory, _pairCodeHash)
  {}

  /// @dev Initialize and register this feature.
  ///      Should be delegatecalled by `Migrate.migrate()`.
  /// @return success `LibMigrate.SUCCESS` on success.
  function migrate() external returns (bytes4 success) {
    _registerFeatureFunction(this.sellNFT.selector);
    _registerFeatureFunction(this.sellAndSwapNFT.selector);
    _registerFeatureFunction(this.onERC721Received.selector);
    _registerFeatureFunction(this.onERC1155Received.selector);
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
  /// @param nftTokenIdMerkleProof The merkle proof used in
  ///        combination with `nftTokenId` and
  ///        `buyOrder.nftTokenIdMerkleRoot` to prove that
  ///        `nftTokenId` can fill the buy order.
  function sellNFT(
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    bool unwrapNativeToken,
    bytes32[] memory nftTokenIdMerkleProof
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
        nftTokenIdMerkleProof
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
      nftSellAmount
    );
  }

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
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    uint256 nftTokenId,
    uint128 nftSellAmount,
    LibShoyuNFTOrder.SwapExactInDetails memory swapDetails,
    bytes32[] memory nftTokenIdMerkleProof
  ) public override {
    require(
      swapDetails.path[0] == address(buyOrder.erc20Token),
      "sellAndSwapNFT::TOKEN_MISMATCH"
    );

    uint256 erc20FillAmount = _sellNFT(
      buyOrder,
      signature,
      SellParams(
        nftSellAmount,
        nftTokenId,
        false, // unwrapNativeToken
        address(this), // taker - set to `this` so we can swap the funds before sending funds to taker
        msg.sender, // owner
        nftTokenIdMerkleProof
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
      params.taker,
      buyOrder.nonce,
      buyOrder.erc20Token,
      buyOrder.erc20TokenAmount,
      buyOrder.nftToken,
      params.tokenId,
      params.sellAmount
    );
  }

  /// @dev Callback for the ERC721 `safeTransferFrom` function.
  ///      This callback can be used to sell an ERC721 asset if
  ///      a valid ERC721 order, signature and `unwrapNativeToken`
  ///      are encoded in `data`. This allows takers to sell their
  ///      ERC721 asset without first calling `setApprovalForAll`.
  /// @param operator The address which called `safeTransferFrom`.
  /// @param tokenId The ID of the asset being transferred.
  /// @param data Additional data with no specified format. If a
  ///        valid ERC721 order, signature, `merkleProof` and
  ///        `unwrapNativeToken` are encoded in `data`, this function
  ///        will try to fill the order using the received asset.
  /// @return success The selector of this function (0x150b7a02),
  ///         indicating that the callback succeeded.
  function onERC721Received(
    address operator,
    address /* from */,
    uint256 tokenId,
    bytes calldata data
  )
    external
    override
    returns (bytes4 success)
  {
    _onNFTReceived(operator, tokenId, 1, data);

    return ERC721_RECEIVED_MAGIC_BYTES;
  }

  /// @dev Callback for the ERC1155 `safeTransferFrom` function.
  ///      This callback can be used to sell an ERC1155 asset if
  ///      a valid ERC1155 order, signature and `unwrapNativeToken`
  ///      are encoded in `data`. This allows takers to sell their
  ///      ERC1155 asset without first calling `setApprovalForAll`.
  /// @param operator The address which called `safeTransferFrom`.
  /// @param tokenId The ID of the asset being transferred.
  /// @param value The amount being transferred.
  /// @param data Additional data with no specified format. If a
  ///        valid ERC1155 order, signature, `merkleProof` and
  ///        `unwrapNativeToken` are encoded in `data`, this function
  ///        will try to fill the order using the received asset.
  /// @return success The selector of this function (0xf23a6e61),
  ///         indicating that the callback succeeded.
  function onERC1155Received(
    address operator,
    address /* from */,
    uint256 tokenId,
    uint256 value,
    bytes calldata data
  )
    external
    override
    returns (bytes4 success)
  {
    _onNFTReceived(operator, tokenId, value, data);

    return ERC1155_RECEIVED_MAGIC_BYTES;
  }

  function _onNFTReceived(
    address operator,
    uint256 tokenId,
    uint256 value,
    bytes calldata data
  ) internal {
    // Decode the order, signature, `unwrapNativeToken`, and
    // `merkleProof` from from `data`. If `data` does not encode
    // such parameters, this will throw.
    (
      LibShoyuNFTOrder.NFTOrder memory buyOrder,
      LibSignature.Signature memory signature,
      bool unwrapNativeToken,
      bytes32[] memory merkleProof
    ) = abi.decode(
      data,
      (LibShoyuNFTOrder.NFTOrder, LibSignature.Signature, bool, bytes32[])
    );

    // `onNFTContract` is called by the NFT token contract.
    // Check that it matches the NFT token in the order.
    if (msg.sender != address(buyOrder.nftToken)) {
      LibShoyuNFTOrdersRichErrors.TokenMismatchError(
        msg.sender,
        address(buyOrder.nftToken)
      ).rrevert();
    }

    _sellNFT(
      buyOrder,
      signature,
      SellParams(
        value.safeDowncastToUint128(),
        tokenId,
        unwrapNativeToken,
        operator, // taker
        address(this), // owner (we hold the NFT currently)
        merkleProof
      )
    );
  }
}
