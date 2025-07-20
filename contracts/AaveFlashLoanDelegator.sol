// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { FlashLoanSimpleReceiverBase } from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import { IPoolAddressesProvider } from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @title AaveFlashLoan
/// @author https://twitter.com/mnedelchev_
contract AaveFlashLoanDelegator is FlashLoanSimpleReceiverBase {
    /// @notice A nonce used for replay protection.
    uint256 public nonce;

    /// @notice Represents a single call within a batch.
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    /// @notice Emitted for every individual call executed.
    event CallExecuted(address indexed sender, address indexed to, uint256 value, bytes data);
    /// @notice Emitted when a full batch is executed.
    event BatchExecuted(uint256 indexed nonce, Call[] calls);

    constructor(address _addressProvider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {}

    /**
     * @notice Executes a batch of calls directly.
     * @dev This function is intended for use when the smart account itself (i.e. address(this))
     * calls the contract. It checks that msg.sender is the contract itself.
     * @param calls An array of Call structs containing destination, ETH value, and calldata.
     */
    function execute(Call[] calldata calls) external payable {
        require(msg.sender == address(this), "Invalid authority");
        _executeBatch(calls);
    }

    /**
     * @dev Internal function that handles batch execution and nonce incrementation.
     * @param calls An array of Call structs.
     */
    function _executeBatch(Call[] calldata calls) internal {
        uint256 currentNonce = nonce;
        nonce++; // Increment nonce to protect against replay attacks

        for (uint256 i = 0; i < calls.length; i++) {
            _executeCall(calls[i]);
        }

        emit BatchExecuted(currentNonce, calls);
    }

    /**
     * @dev Internal function to execute a single call.
     * @param callItem The Call struct containing destination, value, and calldata.
     */
    function _executeCall(Call calldata callItem) internal {
        (bool success,) = callItem.to.call{value: callItem.value}(callItem.data);
        require(success, "Call reverted");
        emit CallExecuted(msg.sender, callItem.to, callItem.value, callItem.data);
    }

    // request flash loan from Aave V3 protocol
    function flashLoanSimple(
        address token, 
        uint256 amount,
        address[] calldata targets,
        uint[] calldata values,
        bytes[] calldata targetData
    ) public {
        require(targets.length == values.length && targets.length == targetData.length, "ERROR: INVALID TARGETS DATA");
        bytes memory params = abi.encode(targets, values, targetData);

        POOL.flashLoanSimple(
            address(this),
            token,
            amount,
            params,
            0
        );
    }

    // Callback to be called by Aave V3 to provide the smart contract with the flashloan earlier requested
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    )  external override returns (bool) {
        require(msg.sender == address(POOL), "ERROR: AUTH - INVALID POOL");
        require(initiator == address(this), "ERROR: AUTH - INVALID INITIATOR");

        (address[] memory targets, uint[] memory values, bytes[] memory targetData) = abi.decode(params, (address[], uint[], bytes[]));
        require(targets.length == values.length && targets.length == targetData.length, "ERROR: INVALID TARGETS DATA");

        for (uint i = 0; i < targets.length; ++i) {
            (bool success,) = address(targets[i]).call{value: values[i]}(targetData[i]);
            require(success, "ERROR: Call reverted");
        }

        // approval to return back the flashloan + the small fee charged by Aave
        IERC20(asset).approve(address(POOL), amount + premium);
        return true;
    }

    fallback() external payable {}
    receive() external payable {}
}