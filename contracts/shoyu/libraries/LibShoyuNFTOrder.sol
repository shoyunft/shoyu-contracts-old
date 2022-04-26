pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";

/// @dev A library for common NFT order operations.
library LibShoyuNFTOrder {
  address internal constant NATIVE_TOKEN_ADDRESS =
    0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  bytes32 internal constant MAX_MERKLE_ROOT =
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

  enum OrderStatus {
    INVALID,
    FILLABLE,
    UNFILLABLE,
    EXPIRED
  }

  enum TradeDirection {
    SELL_NFT,
    BUY_NFT
  }

  enum NFTStandard {
    ERC721,
    ERC1155
  }

  struct Fee {
    address recipient;
    uint256 amount;
  }

  struct SwapExactOutDetails {
    address[] path;
    uint256 amountInMax;
    uint256 amountOut;
  }

  struct SwapExactInDetails {
    address[] path;
    uint256 amountIn;
    uint256 amountOutMin;
  }

  // TODO: is there a better way to pack this?
  struct NFTOrder {
    TradeDirection direction;
    address maker;
    address taker;
    uint256 expiry;
    uint256 nonce;
    IERC20TokenV06 erc20Token;
    uint256 erc20TokenAmount;
    Fee[] fees;
    address nftToken;
    uint256 nftTokenId;
    uint128 nftTokenAmount;
    NFTStandard nftStandard;
    bytes32 nftTokenIdsMerkleRoot;
  }

  struct OrderInfo {
    bytes32 orderHash;
    OrderStatus status;
    // `orderAmount` is 1 for all ERC721's, and
    // `nftTokenAmount` for ERC1155's.
    uint128 orderAmount;
    // The remaining amount of the ERC721/ERC1155 asset
    // that can be filled for the order.
    uint128 remainingAmount;
  }

  // The type hash for NFT orders, which is:
  // keccak256(abi.encodePacked(
  //     "NFTOrder(",
  //       "uint8 direction,",
  //       "address maker,",
  //       "address taker,",
  //       "uint256 expiry,",
  //       "uint256 nonce,",
  //       "address erc20Token,",
  //       "uint256 erc20TokenAmount,",
  //       "Fee[] fees,",
  //       "address nftToken,",
  //       "uint256 nftTokenId,",
  //       "uint128 nftTokenAmount",
  //       "uint8 nftStandard,",
  //       "bytes32 nftTokenIdsMerkleRoot,",
  //     ")",
  //     "Fee(",
  //       "address recipient,",
  //       "uint256 amount",
  //     ")"
  // ))
  uint256 private constant _NFT_ORDER_TYPEHASH =
    0x2667c2b55ebbf51f58678b933d290274f12938708e14920a5926f8d1be7af85d;

  // keccak256(abi.encodePacked(
  //     "Fee(",
  //       "address recipient,",
  //       "uint256 amount",
  //     ")"
  // ))
  uint256 private constant _FEE_TYPEHASH =
    0xfe66e05843363d63611ea99f9490e5edd8ffc1f951c97666da1eeafddf12f9a1;

  // keccak256("");
  bytes32 private constant _EMPTY_ARRAY_KECCAK256 =
    0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

  uint256 private constant ADDRESS_MASK = (1 << 160) - 1;

  /// @dev Get the struct hash of an NFT order.
  /// @param order The NFT order.
  /// @return structHash The struct hash of the order.
  function getNFTOrderStructHash(NFTOrder memory order)
    internal
    pure
    returns (bytes32 structHash)
  {
    bytes32 feesHash = _feesHash(order.fees);

    // Hash in place, equivalent to:
    // return keccak256(abi.encode(
    //     _NFT_ORDER_TYPEHASH,
    //     order.direction,
    //     order.maker,
    //     order.taker,
    //     order.expiry,
    //     order.nonce,
    //     order.erc20Token,
    //     order.erc20TokenAmount,
    //     feesHash,
    //     order.nftToken,
    //     order.nftTokenId,
    //     order.nftTokenAmount,
    //     order.nftStandard,
    //     order.nftTokenIdsMerkleRoot
    // ));

    assembly {
      if lt(order, 32) {
        invalid()
      } // Don't underflow memory.

      let typeHashPos := sub(order, 32) // order - 32
      let feesHashPos := add(order, 224) // order + (32 * 7)

      let typeHashMemBefore := mload(typeHashPos)
      let feesHashMemBefore := mload(feesHashPos)

      mstore(typeHashPos, _NFT_ORDER_TYPEHASH)
      mstore(feesHashPos, feesHash)
      structHash := keccak256(
        typeHashPos,
        448 /* 32 * 14 */
      )

      mstore(typeHashPos, typeHashMemBefore)
      mstore(feesHashPos, feesHashMemBefore)
    }

    return structHash;
  }

  // Hashes the `fees` array as part of computing the
  // EIP-712 hash of an `NFTOrder`.
  function _feesHash(Fee[] memory fees)
    private
    pure
    returns (bytes32 feesHash)
  {
    uint256 numFees = fees.length;
    
    // We give `fees.length == 0` and `fees.length == 1`
    // special treatment because we expect these to be the most common.
    // TODO: add fees.length == 2 and remove == 0
    if (numFees == 0) {
      feesHash = _EMPTY_ARRAY_KECCAK256;
    } else if (numFees == 1) {
      // feesHash = keccak256(abi.encodePacked(keccak256(abi.encode(
      //     _FEE_TYPEHASH,
      //     fees[0].recipient,
      //     fees[0].amount
      // ))));
      Fee memory fee = fees[0];
      assembly {
        // Load free memory pointer
        let mem := mload(64)
        mstore(mem, _FEE_TYPEHASH)
        // fee.recipient
        mstore(add(mem, 32), and(ADDRESS_MASK, mload(fee)))
        // fee.amount
        mstore(add(mem, 64), mload(add(fee, 32)))
        mstore(mem, keccak256(mem, 96))
        feesHash := keccak256(mem, 32)
      }
    } else {
      bytes32[] memory feeStructHashArray = new bytes32[](numFees);
      for (uint256 i = 0; i < numFees; i++) {
        feeStructHashArray[i] = keccak256(
          abi.encode(
            _FEE_TYPEHASH,
            fees[i].recipient,
            fees[i].amount
          )
        );
      }
      assembly {
        feesHash := keccak256(add(feeStructHashArray, 32), mul(numFees, 32))
      }
    }
  }
}
