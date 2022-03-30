pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "../0x/vendor/IPropertyValidator.sol";

/// @dev A library for common NFT order operations.
library LibShoyuNFTOrder {
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

  struct Property {
    IPropertyValidator propertyValidator;
    bytes propertyData;
  }

  struct Fee {
    address recipient;
    uint256 amount;
    bytes feeData;
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
    Property[] nftTokenProperties;
    uint128 nftTokenAmount;
    NFTStandard nftStandard;
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
  //       "Property[] nftTokenProperties,",
  //       "uint128 nftTokenAmount",
  //       "uint8 nftStandard,",
  //     ")",
  //     "Fee(",
  //       "address recipient,",
  //       "uint256 amount,",
  //       "bytes feeData",
  //     ")",
  //     "Property(",
  //       "address propertyValidator,",
  //       "bytes propertyData",
  //     ")"
  // ))
  uint256 private constant _NFT_ORDER_TYPEHASH =
    0x28ffda96e4cd62c373e1d42f0c016401e62a6e6d7043adedd59f6a999d339b79;

  // keccak256(abi.encodePacked(
  //     "Fee(",
  //       "address recipient,",
  //       "uint256 amount,",
  //       "bytes feeData",
  //     ")"
  // ))
  uint256 private constant _FEE_TYPEHASH =
    0xe68c29f1b4e8cce0bbcac76eb1334bdc1dc1f293a517c90e9e532340e1e94115;

  // keccak256(abi.encodePacked(
  //     "Property(",
  //       "address propertyValidator,",
  //       "bytes propertyData",
  //     ")"
  // ))
  uint256 private constant _PROPERTY_TYPEHASH =
    0x6292cf854241cb36887e639065eca63b3af9f7f70270cebeda4c29b6d3bc65e8;

  // keccak256("");
  bytes32 private constant _EMPTY_ARRAY_KECCAK256 =
    0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

  // keccak256(abi.encodePacked(keccak256(abi.encode(
  //     _PROPERTY_TYPEHASH,
  //     address(0),
  //     keccak256("")
  // ))));
  bytes32 private constant _NULL_PROPERTY_STRUCT_HASH =
    0x720ee400a9024f6a49768142c339bf09d2dd9056ab52d20fbe7165faba6e142d;

  uint256 private constant ADDRESS_MASK = (1 << 160) - 1;

  /// @dev Get the struct hash of an NFT order.
  /// @param order The NFT order.
  /// @return structHash The struct hash of the order.
  function getNFTOrderStructHash(NFTOrder memory order)
    internal
    pure
    returns (bytes32 structHash)
  {
    bytes32 propertiesHash = _propertiesHash(order.nftTokenProperties);
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
    //     propertiesHash,
    //     order.nftTokenAmount,
    //     order.nftStandard
    // ));

    assembly {
      if lt(order, 32) {
        invalid()
      } // Don't underflow memory.

      let typeHashPos := sub(order, 32) // order - 32
      let feesHashPos := add(order, 224) // order + (32 * 7)
      let propertiesHashPos := add(order, 320) // order + (32 * 10)

      let typeHashMemBefore := mload(typeHashPos)
      let feesHashMemBefore := mload(feesHashPos)
      let propertiesHashMemBefore := mload(propertiesHashPos)

      mstore(typeHashPos, _NFT_ORDER_TYPEHASH)
      mstore(feesHashPos, feesHash)
      mstore(propertiesHashPos, propertiesHash)
      structHash := keccak256(
        typeHashPos,
        448 /* 32 * 14 */
      )

      mstore(typeHashPos, typeHashMemBefore)
      mstore(feesHashPos, feesHashMemBefore)
      mstore(propertiesHashPos, propertiesHashMemBefore)
    }

    return structHash;
  }

  // Hashes the `properties` array as part of computing the
  // EIP-712 hash of an `ERC721Order` or `ERC1155Order`.
  function _propertiesHash(Property[] memory properties)
    private
    pure
    returns (bytes32 propertiesHash)
  {
    uint256 numProperties = properties.length;
    // We give `properties.length == 0` and `properties.length == 1`
    // special treatment because we expect these to be the most common.
    if (numProperties == 0) {
      propertiesHash = _EMPTY_ARRAY_KECCAK256;
    } else if (numProperties == 1) {
      Property memory property = properties[0];
      if (
        address(property.propertyValidator) == address(0) &&
        property.propertyData.length == 0
      ) {
        propertiesHash = _NULL_PROPERTY_STRUCT_HASH;
      } else {
        // propertiesHash = keccak256(abi.encodePacked(keccak256(abi.encode(
        //     _PROPERTY_TYPEHASH,
        //     properties[0].propertyValidator,
        //     keccak256(properties[0].propertyData)
        // ))));
        bytes32 dataHash = keccak256(property.propertyData);
        assembly {
          // Load free memory pointer
          let mem := mload(64)
          mstore(mem, _PROPERTY_TYPEHASH)
          // property.propertyValidator
          mstore(add(mem, 32), and(ADDRESS_MASK, mload(property)))
          // keccak256(property.propertyData)
          mstore(add(mem, 64), dataHash)
          mstore(mem, keccak256(mem, 96))
          propertiesHash := keccak256(mem, 32)
        }
      }
    } else {
      bytes32[] memory propertyStructHashArray = new bytes32[](numProperties);
      for (uint256 i = 0; i < numProperties; i++) {
        propertyStructHashArray[i] = keccak256(
          abi.encode(
            _PROPERTY_TYPEHASH,
            properties[i].propertyValidator,
            keccak256(properties[i].propertyData)
          )
        );
      }
      assembly {
        propertiesHash := keccak256(
          add(propertyStructHashArray, 32),
          mul(numProperties, 32)
        )
      }
    }
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
    if (numFees == 0) {
      feesHash = _EMPTY_ARRAY_KECCAK256;
    } else if (numFees == 1) {
      // feesHash = keccak256(abi.encodePacked(keccak256(abi.encode(
      //     _FEE_TYPEHASH,
      //     fees[0].recipient,
      //     fees[0].amount,
      //     keccak256(fees[0].feeData)
      // ))));
      Fee memory fee = fees[0];
      bytes32 dataHash = keccak256(fee.feeData);
      assembly {
        // Load free memory pointer
        let mem := mload(64)
        mstore(mem, _FEE_TYPEHASH)
        // fee.recipient
        mstore(add(mem, 32), and(ADDRESS_MASK, mload(fee)))
        // fee.amount
        mstore(add(mem, 64), mload(add(fee, 32)))
        // keccak256(fee.feeData)
        mstore(add(mem, 96), dataHash)
        mstore(mem, keccak256(mem, 128))
        feesHash := keccak256(mem, 32)
      }
    } else {
      bytes32[] memory feeStructHashArray = new bytes32[](numFees);
      for (uint256 i = 0; i < numFees; i++) {
        feeStructHashArray[i] = keccak256(
          abi.encode(
            _FEE_TYPEHASH,
            fees[i].recipient,
            fees[i].amount,
            keccak256(fees[i].feeData)
          )
        );
      }
      assembly {
        feesHash := keccak256(add(feeStructHashArray, 32), mul(numFees, 32))
      }
    }
  }
}
