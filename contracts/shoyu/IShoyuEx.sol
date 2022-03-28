pragma solidity ^0.6.5;
pragma experimental ABIEncoderV2;

import "../0x/IZeroEx.sol";
import "./IShoyuNFTOrdersFeature.sol";

/// @dev Interface for a fully featured Exchange Proxy.
interface IShoyuEx is IZeroEx, IShoyuNFTOrdersFeature {

}
