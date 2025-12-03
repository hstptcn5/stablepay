import { ethers } from 'ethers';
import {
    BANK_ADDRESS,
    BANK_ABI,
    STABLE_RPC_URL,
    INVOICE_REGISTRY_ABI,
    INVOICE_REGISTRY_BYTECODE
} from '../constants';
import { Invoice, InvoiceStatus } from '../types';

export const getProvider = () => {
    if ((window as any).ethereum) {
        return new ethers.BrowserProvider((window as any).ethereum);
    }
    // Fallback to read-only provider if no wallet
    return new ethers.JsonRpcProvider(STABLE_RPC_URL);
};

export const connectWallet = async () => {
    if (!(window as any).ethereum) throw new Error("No wallet found");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    // Switch chain
    try {
        await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x899' }], // 2201 in hex
        });
    } catch (switchError: any) {
        if (switchError.code === 4902) {
            await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                    {
                        chainId: '0x899',
                        chainName: 'Stable Testnet',
                        nativeCurrency: { name: 'gUSDT', symbol: 'gUSDT', decimals: 18 },
                        rpcUrls: [STABLE_RPC_URL],
                        blockExplorerUrls: ['https://testnet.stable.xyz'],
                    },
                ],
            });
        }
    }

    return signer;
};

// Contract Interactions

export const getBankContract = (runner: ethers.ContractRunner) => {
    return new ethers.Contract(BANK_ADDRESS, BANK_ABI, runner);
};

export const getInvoiceRegistry = (address: string, runner: ethers.ContractRunner) => {
    return new ethers.Contract(address, INVOICE_REGISTRY_ABI, runner);
};

export const deployRegistry = async (signer: ethers.Signer) => {
    const factory = new ethers.ContractFactory(INVOICE_REGISTRY_ABI, INVOICE_REGISTRY_BYTECODE, signer);
    // Gas optimization: Stable doesn't use priority fee
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    return await contract.getAddress();
};

export const createInvoice = async (
    registryAddress: string,
    signer: ethers.Signer,
    amount: string,
    payer: string = ethers.ZeroAddress,
    expiryMinutes: number,
    metadataString: string
) => {
    const registry = getInvoiceRegistry(registryAddress, signer);
    const amountWei = ethers.parseUnits(amount, 18); // gUSDT has 18 decimals
    const expiry = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);

    // The contract now takes (payer, amount, expiresAt, metadataString)
    // The contract calculates hash internally and emits the string in event
    const tx = await registry.createInvoice(payer, amountWei, expiry, metadataString);
    return await tx.wait();
};

export const cancelInvoice = async (registryAddress: string, signer: ethers.Signer, invoiceId: string) => {
    const registry = getInvoiceRegistry(registryAddress, signer);
    const tx = await registry.cancelInvoice(invoiceId);
    return await tx.wait();
};

export const approvePayment = async (registryAddress: string, signer: ethers.Signer, amount: string) => {
    const bank = getBankContract(signer);
    const amountWei = ethers.parseUnits(amount, 18);
    // Approve exactly the amount needed or max
    const tx = await bank.approve(registryAddress, amountWei);
    return await tx.wait();
};

export const payInvoice = async (registryAddress: string, signer: ethers.Signer, invoiceId: string) => {
    const registry = getInvoiceRegistry(registryAddress, signer);
    const tx = await registry.pay(invoiceId);
    return await tx.wait();
};

export const checkAllowance = async (owner: string, spender: string, provider: ethers.Provider) => {
    const bank = getBankContract(provider);
    const allowance = await bank.allowance(owner, spender);
    return ethers.formatUnits(allowance, 18);
};

// --- Gasless Invoice (EIP-712) ---

export const getNonce = async (registryAddress: string, owner: string, provider: ethers.Provider) => {
    const registry = getInvoiceRegistry(registryAddress, provider);
    return await registry.nonces(owner);
};

export const signInvoice = async (
    registryAddress: string,
    signer: ethers.Signer,
    invoiceData: {
        payer: string,
        amount: string,
        expiresAt: number,
        metadataString: string
    }
) => {
    const chainId = (await signer.provider!.getNetwork()).chainId;
    const merchant = await signer.getAddress();

    // Fetch current nonce
    const registry = getInvoiceRegistry(registryAddress, signer.provider!);
    const nonce = await registry.nonces(merchant);

    const domain = {
        name: 'StablePay',
        version: '1',
        chainId: chainId,
        verifyingContract: registryAddress
    };

    const types = {
        Invoice: [
            { name: 'merchant', type: 'address' },
            { name: 'payer', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'expiresAt', type: 'uint64' },
            { name: 'metaHash', type: 'bytes32' },
            { name: 'nonce', type: 'uint256' }
        ]
    };

    const amountWei = ethers.parseUnits(invoiceData.amount, 18);
    const metaHash = ethers.keccak256(ethers.toUtf8Bytes(invoiceData.metadataString));

    const value = {
        merchant: merchant,
        payer: invoiceData.payer,
        amount: amountWei,
        expiresAt: invoiceData.expiresAt,
        metaHash: metaHash,
        nonce: nonce
    };

    const signature = await signer.signTypedData(domain, types, value);
    return { signature, nonce: nonce.toString() };
};

export const payGaslessInvoice = async (
    registryAddress: string,
    signer: ethers.Signer,
    invoiceData: {
        merchant: string,
        payer: string,
        amount: string,
        expiresAt: number,
        metadataString: string
    },
    signature: string
) => {
    const registry = getInvoiceRegistry(registryAddress, signer);
    const amountWei = ethers.parseUnits(invoiceData.amount, 18);
    const sig = ethers.Signature.from(signature);

    const tx = await registry.createAndPayInvoice(
        invoiceData.merchant,
        invoiceData.payer,
        amountWei,
        invoiceData.expiresAt,
        invoiceData.metadataString,
        sig.v,
        sig.r,
        sig.s
    );
    return await tx.wait();

};

// --- Indexing / Data Retrieval ---

export const getMerchantInvoices = async (
    registryAddress: string,
    merchantAddress: string,
    provider: ethers.Provider
): Promise<Invoice[]> => {
    const registry = getInvoiceRegistry(registryAddress, provider);

    // Filter for InvoiceCreated events where merchant is the 1st indexed argument
    // event InvoiceCreated(..., address indexed merchant, ..., string metadata);
    const filter = registry.filters.InvoiceCreated(null, merchantAddress);

    // Fetch logs from recent blocks to avoid RPC limit (max 10k blocks)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Query last 10k blocks
    const logs = await registry.queryFilter(filter, fromBlock, "latest");

    // Reverse logs to show newest first
    const reversedLogs = logs.reverse();

    // Fetch current state for each invoice
    const invoices = await Promise.all(reversedLogs.map(async (log: any) => {
        try {
            const parsed = registry.interface.parseLog({ topics: log.topics.slice(), data: log.data });
            if (!parsed) return null;

            const invoiceId = parsed.args.invoiceId.toString();
            // Metadata is now in the event args!
            const metadataString = parsed.args.metadata;

            // Get current state from contract (to check if Paid/Cancelled)
            const currentData = await registry.getInvoice(invoiceId);

            let desc = "No description";
            try {
                const json = JSON.parse(metadataString);
                desc = json.d || json.description || metadataString;
            } catch {
                desc = metadataString;
            }

            return {
                id: invoiceId,
                merchant: currentData.merchant,
                payer: currentData.payer,
                amount: ethers.formatUnits(currentData.amount, 18),
                expiresAt: Number(currentData.expiresAt),
                status: Number(currentData.status),
                metaHash: currentData.metaHash,
                description: desc // Populated from Log!
            } as Invoice;
        } catch (e) {
            console.error("Error parsing log", e);
            return null;
        }
    }));

    return invoices.filter(i => i !== null) as Invoice[];
};