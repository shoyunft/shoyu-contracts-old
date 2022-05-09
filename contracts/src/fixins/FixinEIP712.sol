// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2020 ZeroEx Intl.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Adapted from:
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/fixins/FixinEIP712.sol
*/

pragma solidity ^0.6.5;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/errors/LibRichErrorsV06.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibCommonRichErrors.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibOwnableRichErrors.sol";

/// @dev EIP712 helpers for features.
abstract contract FixinEIP712 {
  /// @dev The domain hash separator for the entire exchange proxy.
  bytes32 public immutable EIP712_DOMAIN_SEPARATOR;

  constructor(address shoyuExAddress) internal {
    // Compute `EIP712_DOMAIN_SEPARATOR`
    {
      uint256 chainId;
      assembly { chainId := chainid() }
      EIP712_DOMAIN_SEPARATOR = keccak256(
        abi.encode(
          keccak256(
            "EIP712Domain("
              "string name,"
              "string version,"
              "uint256 chainId,"
              "address verifyingContract"
            ")"
          ),
          keccak256("ShoyuEx"),
          keccak256("1.0.0"),
          chainId,
          shoyuExAddress
        )
      );
    }
  }

  function _getEIP712Hash(bytes32 structHash)
    internal
    view
    returns (bytes32 eip712Hash)
  {
    return keccak256(abi.encodePacked(
      hex"1901",
      EIP712_DOMAIN_SEPARATOR,
      structHash
    ));
  }
}
