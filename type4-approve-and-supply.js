import { ethers } from "ethers"
import config from "./config.js"
import "dotenv/config"

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY_OWNER, provider);
const targetAddress = '0x69e2C6013Bd8adFd9a54D7E0528b740bac4Eb87C'; // Sample delegation contract address on Sepolia provided by QuickNode
const targetContractABI = [
    "function execute((address,uint256,bytes)[] calls) external payable",
    "function execute((address,uint256,bytes)[] calls, bytes signature) external payable",
    "function nonce() external view returns (uint256)"
];

const WBTC = new ethers.Contract(
    config.WBTC_ADDRESS,
    config.WBTC_ABI,
    provider
);

const AAVE = new ethers.Contract(
    config.AAVE_ADDRESS,
    config.AAVE_ABI,
    provider
);

const DELEGATE_CONTRACT = new ethers.Contract(
    signer.address,
    targetContractABI,
    signer
);

async function init() {
    const auth = await signer.authorize({
        address: targetAddress,
        nonce: await signer.getNonce() + 1,
        chainId: 11155111
    });
    console.log("Authorization created with nonce:", auth.nonce);

    const supplyAmount = 1000;
    const calls = [
        [WBTC.target, 0, WBTC.interface.encodeFunctionData("approve", [AAVE.target, supplyAmount])],
        [AAVE.target, 0, AAVE.interface.encodeFunctionData("supply", [
            WBTC.target,
            supplyAmount,
            signer.address,
            0
        ])]
    ];
    console.log(calls, 'calls');

    const tx = await DELEGATE_CONTRACT["execute((address,uint256,bytes)[])"](
        calls,
        {
            type: 4,
            authorizationList: [auth],
        }
    );
    
    console.log("Non-sponsored transaction sent:", tx.hash);
}
init();