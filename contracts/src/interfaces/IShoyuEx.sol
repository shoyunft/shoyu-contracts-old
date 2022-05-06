pragma solidity ^0.6.5;
pragma experimental ABIEncoderV2;

import "@0x/contracts-zero-ex/contracts/src/features/interfaces/IOwnableFeature.sol";
import "@0x/contracts-zero-ex/contracts/src/features/interfaces/ISimpleFunctionRegistryFeature.sol";
import "./IShoyuNFTOrdersFeature.sol";
import "./IShoyuNFTBuyOrdersFeature.sol";
import "./IShoyuNFTSellOrdersFeature.sol";
import "./IShoyuNFTOrderEvents.sol";

/// @dev Interface for Shoyu Exchange Proxy.
interface IShoyuEx is 
    IOwnableFeature,
    ISimpleFunctionRegistryFeature,
    IShoyuNFTOrdersFeature,
    IShoyuNFTBuyOrdersFeature,
    IShoyuNFTSellOrdersFeature,
    IShoyuNFTOrderEvents
{
    /// @dev Fallback for just receiving ether.
    receive() external payable;
}
