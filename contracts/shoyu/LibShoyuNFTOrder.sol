pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";

/// @dev A library for common NFT order operations.
library LibShoyuNFTOrder {
  struct SwapExactOutDetails {
    address[] path;
    uint256 maxAmountIn;
    uint256 amountOut;
  }
}
