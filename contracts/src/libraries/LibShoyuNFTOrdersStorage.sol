pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-zero-ex/contracts/src/storage/LibStorage.sol";

/// @dev Storage helpers for `ShoyuNFTOrders`.
library LibShoyuNFTOrdersStorage {
  struct OrderState {
    // The amount (denominated in the NFT asset)
    // that the order has been filled by.
    uint128 filledAmount;
    // Whether the order has been pre-signed.
    bool preSigned;
  }

  /// @dev Storage bucket for this feature.
  struct Storage {
    // Mapping from order hash to order state:
    mapping(bytes32 => OrderState) orderState;
    // maker => nonce range => order cancellation bit vector
    mapping(address => mapping(uint248 => uint256)) orderCancellationByMaker;
  }

  /// @dev Get the storage bucket for this contract.
  function getStorage() internal pure returns (Storage storage stor) {
    uint256 storageSlot = LibStorage.getStorageSlot(
      LibStorage.StorageId.ERC1155Orders
    );
    // Dip into assembly to change the slot pointed to by the local
    // variable `stor`.
    // See https://solidity.readthedocs.io/en/v0.6.8/assembly.html?highlight=slot#access-to-external-variables-functions-and-libraries
    assembly {
      stor_slot := storageSlot
    }
  }
}
