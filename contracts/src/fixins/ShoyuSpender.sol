
// SPDX-License-Identifier: Apache-2.0
/*
  Copyright 2021 ZeroEx Intl.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Files referenced:
  - https://github.com/0xProject/protocol/blob/c1177416f50c2465ee030dacc14ff996eebd4e74/contracts/zero-ex/contracts/src/features/nft_orders/NFTOrders.sol
*/

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinERC721Spender.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinERC1155Spender.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinTokenSpender.sol";
import "@0x/contracts-zero-ex/contracts/src/errors/LibNFTOrdersRichErrors.sol";
import "../libraries/LibShoyuNFTOrder.sol";

abstract contract ShoyuSpender is
  FixinTokenSpender,
  FixinERC721Spender,
  FixinERC1155Spender
{
  using LibSafeMathV06 for uint256;
  using LibSafeMathV06 for uint128;

  /// @dev The WETH token contract.
  IEtherTokenV06 private immutable WETH;

  constructor(IEtherTokenV06 _weth) public {
    WETH = _weth;
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
    uint128 amount
  ) internal {
    if (nftStandard == LibShoyuNFTOrder.NFTStandard.ERC721) {
      assert (amount == 1);
      _transferERC721AssetFrom(IERC721Token(token), from, to, tokenId);
    } else {
      _transferERC1155AssetFrom(IERC1155Token(token), from, to, tokenId, amount);
    }
  }

  // From 0x's `_payEthFees()` in `NFTOrders.sol`
  function _payEthFees(
    LibShoyuNFTOrder.NFTOrder memory order,
    uint128 fillAmount,
    uint128 orderAmount,
    uint256 ethSpent,
    uint256 ethAvailable
  ) internal {
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
    // TODO: why won't this compile??
    // if (ethSpent > ethAvailable) {
    //   LibNFTOrdersRichErrors.OverspentEthError(ethSpent, ethAvailable).rrevert();
    // }
    require(
      ethSpent <= ethAvailable,
      "_payEthFees/OVERSPENT_ETH"
    );
  }

  // From 0x's `_payFees()` in `NFTOrders.sol`
  // Changes made:
  // - Removed fee callback
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
          address(order.erc20Token) == LibShoyuNFTOrder.NATIVE_TOKEN_ADDRESS
      );
    }

    for (uint256 i = 0; i < order.fees.length; i++) {
      LibShoyuNFTOrder.Fee memory fee = order.fees[i];

      require(
        fee.recipient != address(this),
        "_payFees/RECIPIENT_CANNOT_BE_EXCHANGE_PROXY"
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

      // Sum the fees paid
      totalFeesPaid = totalFeesPaid.safeAdd(feeFillAmount);
    }
  }
}