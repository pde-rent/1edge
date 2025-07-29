// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// EIP-1271 interface
interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);
}

contract StrategyExecutor is Ownable, IERC1271 {
    using ECDSA for bytes32;

    address public keeper;

    // Mapping from user address => token address => balance
    mapping(address => mapping(address => uint256)) public balances;

    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    event KeeperSet(address indexed newKeeper);
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function setKeeper(address _newKeeper) public onlyOwner {
        require(_newKeeper != address(0), "StrategyExecutor: New keeper is the zero address");
        keeper = _newKeeper;
        emit KeeperSet(_newKeeper);
    }

    function deposit(address token, uint256 amount) external {
        require(amount > 0, "StrategyExecutor: Deposit amount must be greater than 0");
        balances[msg.sender][token] += amount;
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(amount > 0, "StrategyExecutor: Withdraw amount must be greater than 0");
        require(balances[msg.sender][token] >= amount, "StrategyExecutor: Insufficient balance");
        balances[msg.sender][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @dev See {IERC1271-isValidSignature}.
     * This function is called by the 1inch settlement contract to verify that a trade is authorized.
     * It checks if the signature was made by the designated keeper.
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        // Replicate the EIP-191 signed message hash construction
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address signer = ECDSA.recover(prefixedHash, signature);
        if (signer == keeper) {
            return EIP1271_MAGIC_VALUE;
        }
        return "";
    }

    // This function is required for the keeper to approve the 1inch contract to spend funds for a trade.
    // The keeper must call this before submitting the order to the 1inch API.
    function approve(address token, address spender, uint256 amount) external {
        require(msg.sender == keeper, "StrategyExecutor: Caller is not the keeper");
        IERC20(token).approve(spender, amount);
    }
}
