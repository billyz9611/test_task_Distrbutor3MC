// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "solady/src/tokens/ERC20.sol";
import "solady/src/utils/MerkleProofLib.sol";


import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "hardhat/console.sol";


contract Distributor3MC is Ownable2Step {
    // token to be airdroppped
    address public token;
    // root of the merkle tree
    bytes32 public claimRoot;
    // whether the airdrop is active
    bool public active = false;
    // fee to claim
    uint256 public fee;

    mapping(bytes32 => bool) public merkleProofs;
    mapping(address => uint256) public nonces;

    // errors
    error InsufficientBalance();
    error AlreadyClaimed();
    error InvalidMerkleProof();
    error NotActive();
    error ZeroAddress();
    error InsufficientFee();
    error MerkleRootNotSet();

    event AirdropClaimed(address indexed account, uint256 amount);

    modifier feeCheck() {
        if (msg.value < fee) revert InsufficientFee();
        _;
    }

    /// @notice Construct a new Claim contract
    /// @param _token address of the token that will be claimed
    constructor(address _token) Ownable(msg.sender) {
        if (_token == address(0)) revert ZeroAddress();
        token = _token;
    }

    /// @notice Set the claim root
    /// @param _claimRoot root of the merkle tree
    function setClaimRoot(bytes32 _claimRoot) external onlyOwner {
        claimRoot = _claimRoot;
    }

    /// @notice Set the fee
    /// @param _fee fee to claim
    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    /// @notice Withdraw ETH from the contract
    /// @param receiver address to receive the tokens
    function withdrawETH(address receiver) external onlyOwner {
        payable(receiver).transfer(address(this).balance);
    }

    /// @notice Withdraw tokens from the contract
    /// @param receiver address to receive the tokens
    /// @param amount amount of tokens to withdraw
    function withdrawTokens(
        address receiver,
        uint256 amount
    ) external onlyOwner {
        ERC20(token).transfer(receiver, amount);
    }

    /// @notice Toggle the active state
    function toggleActive() external onlyOwner {
        if (claimRoot == bytes32(0)) revert MerkleRootNotSet();
        active = !active;
    }

    /// @notice Claim airdrop tokens. Checks for both merkle proof validation.
    /// @param _proof merkle proof of the claim
    /// @param _amount amount of tokens to claim
    function claim(
        bytes32[] calldata _proof,
        uint256 _amount
    ) external payable feeCheck {
        if (merkleProofs[keccak256(abi.encodePacked(_proof))])
            revert AlreadyClaimed();
        if (ERC20(token).balanceOf(address(this)) < _amount)
            revert InsufficientBalance();
        if (!active) revert NotActive();

        merkleProofs[keccak256(abi.encodePacked(_proof))] = true;
        nonces[msg.sender] += 1;

        _rootCheck(_proof, _amount);

        ERC20(token).transfer(msg.sender, _amount);

        emit AirdropClaimed(msg.sender, _amount);
    }

    /// @notice Internal function to check the merkle proof
    /// @param _proof merkle proof of the claim
    /// @param _amount amount of tokens to claim
    function _rootCheck(
        bytes32[] calldata _proof,
        uint256 _amount
    ) private view {
        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, _amount, nonces[msg.sender])
        );
        // console.logBytes32(leaf);
        if (!MerkleProofLib.verify(_proof, claimRoot, leaf))
            revert InvalidMerkleProof();
    }
}
