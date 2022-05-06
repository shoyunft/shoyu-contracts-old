pragma solidity ^0.6;
pragma experimental ABIEncoderV2;


import "@0x/contracts-zero-ex/contracts/src/features/libs/LibSignature.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "../libraries/LibShoyuNFTOrder.sol";
import "./ShoyuNFTOrders.sol";

abstract contract ShoyuNFTBuyOrders is ShoyuNFTOrders {
  constructor(
    address payable _zeroExAddress,
    IEtherTokenV06 _weth
  ) public ShoyuNFTOrders(_zeroExAddress, _weth)
  {}

  function _validateBuyOrder(
    LibShoyuNFTOrder.NFTOrder memory buyOrder,
    LibSignature.Signature memory signature,
    LibShoyuNFTOrder.OrderInfo memory orderInfo,
    address taker,
    uint256 tokenId,
    bytes32[] memory tokenIdMerkleProof
  ) internal view {
    // Order must be buying the NFT asset.
    require(
      buyOrder.direction == LibShoyuNFTOrder.TradeDirection.BUY_NFT,
      "_validateBuyOrder::WRONG_TRADE_DIRECTION"
    );

    // The ERC20 token must be WETH.
    require(
      address(buyOrder.erc20Token) == address(WETH),
      "_validateBuyOrder::WRAPPED_NATIVE_TOKEN_ONLY"
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

    // Check that the asset with the given token ID satisfies the merkle root
    // specified by the order.
    _validateTokenIdMerkleProof(buyOrder, tokenId, tokenIdMerkleProof);

    // Check the signature.
    _validateOrderSignature(orderInfo.orderHash, signature, buyOrder.maker);
  }
}