# Test Distributor3MC

## Install CMD:
```shell
npm install # download modules
```
## Run test CMDs:
```shell
npx hardhat test # run all test case
REPORT_GAS=true npx hardhat test # run all case and show gas cost
npx hardhat node # run local block chain
npx hardhat run scripts/deploy.ts # deploy Distributor3MC contract on lock block chain
```

## Test cases:
1. only owner can set ClaimRoot 
   * Test points :
        1. user is not the owner, will cannot set ClaimRoot and raise err 'OwnableUnauthorizedAccount'.
        2. user is owner , will set ClaimRoot successfully.
        3. claimRoot is updated
    
1. only owner can set fee
   * Test points :
        1. user is not the owner, will cannot set fee and raise err 'OwnableUnauthorizedAccount'.
        2. user is owner , will set fee successfully.
        3. fee is updated.
1. only owner can withdraw ETH
   * Test points :
        1. user is not the owner, will cannot withdraw ETH of contract and raise err 'OwnableUnauthorizedAccount'.
        2. user is owner , will withdraw all ETH of contract, user balance += contract ETH balance
1. only owner can withdraw token
   * Test points :
        1. user is not the owner, will cannot withdraw token of contract and raise err 'OwnableUnauthorizedAccount'.
        2. user is owner , user can withdraw the exact number of tokens, user token balance += withdraw amount.
        3. if withdraw amount > contract balance , withdraw will be reverted "transfer amount exceeds balance" 
1. only owner can toggleActive
    * Test points :
        1. user is not the owner, will cannot toggleActive and raise err 'OwnableUnauthorizedAccount'.
        2. user is owner , user can toggleActive.
        3. if active is false, will update to true, vice versa.
1. if claimRoot == bytes32(0), toggleActive should not be allowed, vice versa
    * Test points :
        1. if claimRoot == bytes32(0), will cannot toggleActive and raise err 'MerkleRootNotSet.
1. if msg value >= fee, claim should not be reverted
   * Test points :
        1. if value == fee, will claim successfully.
        2. if value > fee, will claim successfully.
    
1. if msg value < fee, claim should be reverted
      * Test points :
        1. if value < fee, will cannot claim and raise err 'InsufficientFee.

1. if user have claimed, claim again should be reverted
       * Test points :
        1. if user have claimed and claim again, will cannot claim and raise err 'AlreadyClaimed'.
1. if contract balance < claim amount, claim should be reverted
    * Test points :
        1. if contract balance < claim amount, will cannot claim and raise err 'InsufficientBalance'.
1. if contract status is not active, claim should be reverted, vice versa
    * Test points :
        1. if contract status is not active, will cannot claim and raise err 'NotActive'.
1. if user claim successfully,merkleProofs and nonces should be updated
    * Test points :
        1. merkleProofs[proof] update to 'true'.
        2. nonces += 1.

1. if user proof is incorrect, claim should be reverted, vice versa
   * Test points :
        1. if user proof is incorrect, will cannot claim and raise err 'InvalidMerkleProof'.
1. if user claim successfully, will receive the token from contract
   * Test points :
        1. user token balance += claim amount
1. if user claim successfully, will emit AirdropClaimed event
    * Test points :
        1. emit AirdropClaimed
        2. emit args : sender , withdraw amount

