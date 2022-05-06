
pragma solidity ^0.6.5;

library LibShoyuNFTOrdersRichErrors {
  function TokenMismatchError(
    address token1,
    address token2
  ) internal pure returns (bytes memory) {
    return abi.encodeWithSelector(
      bytes4(keccak256("TokenMismatchError(address,address)")),
      token1,
      token2
    );
  }
}