# Type 4 Ethereum transactions Demo

### Project setup commands:
* ```npm install``` - Downloading the required packages.
* ```cp .env.example .env``` - After creating `.env` file place the environment variables. The `RPC_URL` must support EIP-7702 standard, for example a free node from [QuickNode](https://www.quicknode.com) will work.

### Purpose:
This repository provides a simple demonstration of how to use Ethereum’s Type 4 transactions to batch multiple actions into a single atomic transaction. Ethereum’s Type 4 transactions enable native support for multi-action atomic operations, improving UX and efficiency by eliminating the need for separate approval and execution steps. In simple words EIP-7702 lets EOAs to now borrow smart contract's code. You can basically think of the smart contract being called with delegatecall in the context of the EOA.

#### Example #1
Covering the most widely used combination of on-chain actions - an approval of token amount and depositing the token amount into pool, vault, etc. Running `node type4-approve-and-supply.js` will perform an atomic transaction which includes two on-chain actions:
1. Granting WBTC approval to Aave's V3 Pool
2. Supplying WBTC to Aave V3

By using this approach there is no longer the need for users to always perform 2 separate transaction for the approval and the actual spending of tokens. Here is a sample transaction of the batching approval and supplying to Aave - [https://sepolia.etherscan.io/tx/0xc4d33a49808987abc55bed40c04344e2efaf5744bba25232920cc6fa41ddd9d1](https://sepolia.etherscan.io/tx/0xc4d33a49808987abc55bed40c04344e2efaf5744bba25232920cc6fa41ddd9d1)

#### Example #2
The usual flow for requesting a flashloan is requiring the flashloan to be requested from a smart contract and then Aave provides the flashloan amount to a fallback method of the requester contract. There is longer the requirement for the flashloan requesters to be smart contracts, because now with EIP-7702 even EOAs can request flashloans. Running `node type4-flashloan-as-EOA.js` will perform an atomic transaction which includes the following on-chain actions:
1. Requesting a WBTC flashloan from Aave V3
2. Granting WBTC approval to Uniswap's V3 Router
3. Swapping WBTC to WETH
4. Swapping back WETH to WBTC
5. Repaying back the flashloan

Here is a sample transaction of the flow described above - [https://sepolia.etherscan.io/tx/0xd6ae72694b4f493a05f427630b89d201a516a5fec2c13bd98b729e157e3c5c7c](https://sepolia.etherscan.io/tx/0xd6ae72694b4f493a05f427630b89d201a516a5fec2c13bd98b729e157e3c5c7c)

> [!WARNING]
> This repo serve as a demo and the code here should not be copied and used in production. Enabling EOAs to act as smart contracts through delegation introduces new challenges and risks.