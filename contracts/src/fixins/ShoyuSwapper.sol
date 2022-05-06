pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-zero-ex/contracts/src/fixins/FixinTokenSpender.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Factory.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "../libraries/UniswapV2Library02.sol";

abstract contract ShoyuSwapper is FixinTokenSpender
{
  using LibSafeMathV06 for uint256;
  
  /// @dev The UniswapV2Factory address.
  address private immutable factory;
  /// @dev The UniswapV2 pair init code.
  bytes32 private immutable pairCodeHash;

  constructor(
    address _factory,
    bytes32 _pairCodeHash
  ) public {
    factory = _factory;
    pairCodeHash = _pairCodeHash;
  }

  // Swaps an exact amount of tokens for another token through the path passed as an argument
  // Returns the amount of the final token
  function _swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] memory path,
    address to
  ) internal returns (uint256 amountOut) {
    uint256[] memory amounts = UniswapV2Library02.getAmountsOut(factory, amountIn, path, pairCodeHash);
    amountOut = amounts[amounts.length - 1];
    require(amountOut >= amountOutMin, "_swapExactTokensForTokens/INSUFFICIENT_AMOUNT_OUT");
    _transferERC20Tokens(
      IERC20TokenV06(path[0]),
      UniswapV2Library02.pairFor(factory, path[0], path[1], pairCodeHash),
      amountIn
    );
    _swap(amounts, path, to);
  }

  // Swaps an some input tokens for an exact amount of the output token
  // Returns the amount of input token we traded
  function _swapTokensForExactTokens(
    uint256 amountOut,
    uint256 amountInMax,
    address[] memory path,
    address to
  ) internal returns (uint256 amountIn) {
    uint256[] memory amounts = UniswapV2Library02.getAmountsIn(factory, amountOut, path, pairCodeHash);
    amountIn = amounts[0];
    require(amountIn <= amountInMax, '_swapTokensForExactTokens/EXCESSIVE_AMOUNT_IN');
    _transferERC20Tokens(
      IERC20TokenV06(path[0]),
      UniswapV2Library02.pairFor(factory, path[0], path[1], pairCodeHash),
      amountIn
    );
    _swap(amounts, path, to);
  }

  function _transferFromAndSwapTokensForExactTokens(
    address from,
    uint256 amountOut,
    uint256 amountInMax,
    address[] memory path,
    address to
  ) internal returns (uint256 amountIn) {
    uint256[] memory amounts = UniswapV2Library02.getAmountsIn(factory, amountOut, path, pairCodeHash);
    amountIn = amounts[0];
    require(amountIn <= amountInMax, '_transferAndSwapTokensForExactTokens/EXCESSIVE_AMOUNT_IN');
    _transferERC20TokensFrom(
        IERC20TokenV06(path[0]),
        from,
        UniswapV2Library02.pairFor(
          factory,
          path[0],
          path[1],
          pairCodeHash
        ),
        amounts[0]
      );
    _swap(amounts, path, to);
  }

  // requires the initial amount to have already been sent to the first pair
  function _swap(
    uint256[] memory amounts,
    address[] memory path,
    address _to
  ) internal virtual {
    for (uint256 i; i < path.length - 1; i++) {
      (address input, address output) = (path[i], path[i + 1]);
      (address token0, ) = UniswapV2Library02.sortTokens(input, output);
      uint256 amountOut = amounts[i + 1];
      (uint256 amount0Out, uint256 amount1Out) = input == token0
        ? (uint256(0), amountOut)
        : (amountOut, uint256(0));
      address to = i < path.length - 2 ? UniswapV2Library02.pairFor(factory, output, path[i + 2], pairCodeHash) : _to;
      IUniswapV2Pair(
        UniswapV2Library02.pairFor(
          factory,
          input,
          output,
          pairCodeHash
        )
      ).swap(
        amount0Out,
        amount1Out,
        to,
        new bytes(0)
      );
    }
  }
}