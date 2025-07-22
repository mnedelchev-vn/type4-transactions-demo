import { ethers } from "ethers"
import config from "./config.js"
import "dotenv/config"

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY_OWNER, provider);
const targetAddress = '0x43342491dE5D3c197cF02Ba219A8D42C3E5482fA'; // Sample delegation contract address on Sepolia that includes Aave V3 flashloan fallback ( located at contracts/AaveFlashLoanDelegator.sol )
const targetContractABI = [{"inputs":[{"internalType":"address","name":"_addressProvider","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"nonce","type":"uint256"},{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"indexed":false,"internalType":"struct AaveFlashLoanDelegator.Call[]","name":"calls","type":"tuple[]"}],"name":"BatchExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"}],"name":"CallExecuted","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"ADDRESSES_PROVIDER","outputs":[{"internalType":"contract IPoolAddressesProvider","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"POOL","outputs":[{"internalType":"contract IPool","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"internalType":"struct AaveFlashLoanDelegator.Call[]","name":"calls","type":"tuple[]"}],"name":"execute","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"premium","type":"uint256"},{"internalType":"address","name":"initiator","type":"address"},{"internalType":"bytes","name":"params","type":"bytes"}],"name":"executeOperation","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address[]","name":"targets","type":"address[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"},{"internalType":"bytes[]","name":"targetData","type":"bytes[]"}],"name":"flashLoanSimple","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"nonce","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}];

const WBTC = new ethers.Contract(
    config.WBTC_ADDRESS,
    config.WBTC_ABI,
    provider
);

const UNISWAP = new ethers.Contract(
    config.UNISWAP_ADDRESS,
    config.UNISWAP_ABI,
    provider
);

const QUOTER = new ethers.Contract(
    config.UNISWAP_QUOTER_V2_ADDRESS,
    config.UNISWAP_QUOTER_V2_ABI,
    provider
);

const DELEGATE_CONTRACT = new ethers.Contract(
    signer.address,
    targetContractABI,
    signer
);

const WBTC_WETH_POOL_FEE = 500;

async function init() {
    const auth = await signer.authorize({
        address: targetAddress,
        nonce: await signer.getNonce() + 1,
        chainId: 11155111
    });
    console.log("Authorization created with nonce:", auth.nonce);

    const borrowAmount = 1000;
    const swapAmount = 1000;
    const quoteResult = await QUOTER.quoteExactInputSingle.staticCall({
        tokenIn: WBTC.target,
        tokenOut: config.WETH_ADDRESS,
        fee: WBTC_WETH_POOL_FEE,
        amountIn: swapAmount,
        sqrtPriceLimitX96: 0
    });

    const calls = [
        [DELEGATE_CONTRACT.target, 0, DELEGATE_CONTRACT.interface.encodeFunctionData("flashLoanSimple", [
            WBTC.target,
            borrowAmount,
            [ // targets addresses to be requested after flashloan is already taken by Aave
                WBTC.target,
                UNISWAP.target,
                UNISWAP.target
            ],
            [ // targets values
                0, 0, quoteResult[0]
            ],
            [ // targets data
                WBTC.interface.encodeFunctionData("approve", [
                    UNISWAP.target,
                    swapAmount
                ]),
                UNISWAP.interface.encodeFunctionData("exactInputSingle", [{
                        tokenIn: WBTC.target,
                        tokenOut: config.WETH_ADDRESS,
                        fee: WBTC_WETH_POOL_FEE,
                        recipient: signer.address,
                        deadline: Math.floor(Date.now() / 1000) + 1800,
                        amountIn: swapAmount,   
                        amountOutMinimum: quoteResult[0], 
                        sqrtPriceLimitX96: 0 // don't set to 0 in production
                    }]
                ),
                UNISWAP.interface.encodeFunctionData("exactInputSingle", [{
                        tokenIn: config.WETH_ADDRESS,
                        tokenOut: WBTC.target,
                        fee: WBTC_WETH_POOL_FEE,
                        recipient: signer.address,
                        deadline: Math.floor(Date.now() / 1000) + 1800,
                        amountIn: quoteResult[0],   
                        amountOutMinimum: 0, // don't set to 0 in production
                        sqrtPriceLimitX96: 0 // don't set to 0 in production
                    }]
                )
            ]
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