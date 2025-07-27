// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";


/// @title TestFrontrun
/// @author https://twitter.com/mnedelchev_
contract TestFrontrun is Initializable {
    address public someOperator;

    error WrongCaller();
    error WithdrawFailed();

    function initialize(address _someOperator) external initializer {
        someOperator = _someOperator;
    }

    function withdraw(uint value) external {
        require(msg.sender == someOperator, WrongCaller());
        
        (bool r,) = someOperator.call{ value: value }("");
        if (!r) revert WithdrawFailed();
    }
}