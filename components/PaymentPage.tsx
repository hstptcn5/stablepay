import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import { Web3State, Invoice, InvoiceStatus } from '../types';
import { getProvider, getInvoiceRegistry, checkAllowance, approvePayment, payInvoice, payGaslessInvoice } from '../services/web3Service';

interface PaymentPageProps {
    web3: Web3State;
    registryAddress: string;
    onConnect: () => void;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ web3, registryAddress, onConnect }) => {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const [searchParams] = useSearchParams();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [allowance, setAllowance] = useState('0');
    const [error, setError] = useState('');

    // Gasless State
    const [isGasless, setIsGasless] = useState(false);
    const [gaslessParams, setGaslessParams] = useState<any>(null);

    // Metadata Verification State
    const [metadata, setMetadata] = useState<{ description: string, verified: boolean } | null>(null);

    const fetchInvoiceData = useCallback(async () => {
        if (!registryAddress || !invoiceId) return;
        try {
            const provider = await getProvider();
            const registry = getInvoiceRegistry(registryAddress, provider);

            // Fetch from contract
            const data = await registry.getInvoice(invoiceId);

            // Check for metadata in URL (?m=...)
            const mParam = searchParams.get('m');
            let decodedDesc = "No description provided.";
            let isVerified = false;

            if (mParam) {
                try {
                    // 1. Decode Base64URL
                    const base64 = mParam.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonStr = atob(base64);

                    // 2. Parse JSON
                    const jsonObj = JSON.parse(jsonStr);
                    const desc = jsonObj.d || jsonObj.description || "Unknown Item";

                    // 3. Re-calculate Hash
                    const reHash = ethers.keccak256(ethers.toUtf8Bytes(jsonStr));

                    if (reHash === data.metaHash) {
                        isVerified = true;
                    }

                    decodedDesc = desc;

                } catch (e) {
                    console.warn("Failed to decode metadata", e);
                    decodedDesc = "Invalid Metadata Link";
                }
            } else {
                decodedDesc = "No details in link.";
            }

            setMetadata({ description: decodedDesc, verified: isVerified });

            setInvoice({
                id: invoiceId,
                merchant: data.merchant,
                payer: data.payer,
                amount: ethers.formatUnits(data.amount, 18),
                expiresAt: Number(data.expiresAt),
                status: Number(data.status),
                metaHash: data.metaHash
            });

            if (web3.address) {
                const allow = await checkAllowance(web3.address, registryAddress, provider);
                setAllowance(allow);
            }
        } catch (e) {
            console.error(e);
            setError("Invoice not found on chain.");
        } finally {
            setLoading(false);
        }
    }, [registryAddress, invoiceId, web3.address, searchParams]);

    // Handle Gasless Params
    useEffect(() => {
        const sig = searchParams.get('sig');
        if (sig) {
            setIsGasless(true);
            const merchant = searchParams.get('merchant') || "";
            const amount = searchParams.get('amount') || "0";
            const expires = searchParams.get('expires') || "0";
            const mParam = searchParams.get('m') || "";
            const payer = searchParams.get('payer') || ethers.ZeroAddress;
            const registry = searchParams.get('registry') || ""; // Get registry from URL

            setGaslessParams({
                merchant,
                amount,
                expiresAt: Number(expires),
                metadataString: "", // Will decode below
                payer,
                signature: sig,
                registry // Store registry address
            });

            // Decode Metadata for Display
            let decodedDesc = "No description";
            let metaString = "";
            if (mParam) {
                try {
                    const base64 = mParam.replace(/-/g, '+').replace(/_/g, '/');
                    metaString = atob(base64);
                    const jsonObj = JSON.parse(metaString);
                    decodedDesc = jsonObj.d || jsonObj.description || "Unknown Item";
                } catch (e) {
                    console.warn("Failed to decode metadata", e);
                }
            }

            // Update Invoice State for Display
            setInvoice({
                id: "GASLESS",
                merchant: merchant,
                payer: payer,
                amount: amount,
                expiresAt: Number(expires),
                status: InvoiceStatus.CREATED, // Assume pending
                metaHash: ethers.keccak256(ethers.toUtf8Bytes(metaString)),
                description: decodedDesc
            } as Invoice);

            setMetadata({ description: decodedDesc, verified: true }); // Trust URL for gasless (signature verifies it)
            setLoading(false);

            // Store metaString for payment call
            setGaslessParams(prev => ({ ...prev, metadataString: metaString }));
        }
    }, [searchParams]);

    useEffect(() => {
        if (!isGasless) {
            fetchInvoiceData();
            const interval = setInterval(fetchInvoiceData, 3000);
            return () => clearInterval(interval);
        }
    }, [fetchInvoiceData, isGasless]);

    const handleApprove = async () => {
        if (!web3.isConnected) return onConnect();
        setProcessing(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();
            await approvePayment(registryAddress, signer, invoice!.amount);
            setAllowance(invoice!.amount);
        } catch (e: any) {
            alert("Approval failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handlePay = async () => {
        if (!web3.isConnected) return onConnect();
        setProcessing(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();
            await payInvoice(registryAddress, signer, invoice!.id);
            setInvoice(prev => prev ? ({ ...prev, status: InvoiceStatus.PAID }) : null);
            alert("Payment Successful!");
        } catch (e: any) {
            console.error(e);
            alert("Payment failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handlePayGasless = async () => {
        if (!web3.isConnected) return onConnect();

        // Use registry from URL params if local registryAddress is empty
        const targetRegistry = registryAddress || (gaslessParams?.registry);
        if (!targetRegistry) {
            alert("No registry contract configured. Please configure in Settings.");
            return;
        }

        setProcessing(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();

            await payGaslessInvoice(
                targetRegistry,
                signer,
                {
                    merchant: gaslessParams.merchant,
                    payer: gaslessParams.payer,
                    amount: gaslessParams.amount,
                    expiresAt: gaslessParams.expiresAt,
                    metadataString: gaslessParams.metadataString
                },
                gaslessParams.signature
            );

            setInvoice(prev => prev ? ({ ...prev, status: InvoiceStatus.PAID }) : null);
            alert("Gasless Payment Successful!");
        } catch (e: any) {
            console.error(e);
            alert("Payment failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="text-center text-white py-20">Loading Invoice...</div>;
    if (error) return <div className="text-center text-red-400 py-20">{error}</div>;
    if (!invoice) return <div className="text-center text-white py-20">Invoice not found</div>;

    const isPaid = invoice.status === InvoiceStatus.PAID;
    const isCancelled = invoice.status === InvoiceStatus.CANCELLED;
    const isSufficientAllowance = parseFloat(allowance) >= parseFloat(invoice.amount);
    const isPayerValid = invoice.payer === ethers.ZeroAddress || (web3.address && invoice.payer.toLowerCase() === web3.address.toLowerCase());

    return (
        <div className="max-w-md mx-auto bg-dark-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 mt-10">
            {/* Header */}
            <div className={`p-6 text-center ${isPaid ? 'bg-green-900/30' : isCancelled ? 'bg-red-900/30' : 'bg-stable-900/30'} border-b border-gray-700`}>
                <div className="text-sm text-gray-400 uppercase tracking-widest mb-2">Total Due</div>
                <div className="text-4xl font-bold text-white font-mono flex items-center justify-center gap-2">
                    {invoice.amount}
                    <span className="text-lg text-stable-500">gUSDT</span>
                </div>
                {isPaid && <div className="mt-2 inline-block px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-full">PAID</div>}
                {isCancelled && <div className="mt-2 inline-block px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">CANCELLED</div>}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-xs text-gray-500 uppercase">Description</div>
                        {metadata?.verified ? (
                            <span className="text-[10px] bg-green-900 text-green-400 px-1 rounded border border-green-700">✓ Verified on-chain</span>
                        ) : (
                            <span className="text-[10px] bg-gray-700 text-gray-400 px-1 rounded">Unverified / Missing</span>
                        )}
                    </div>
                    <div className="text-white text-lg font-medium">
                        {metadata?.description || "No description available"}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Merchant</div>
                        <div className="text-gray-300 font-mono truncate" title={invoice.merchant}>
                            {invoice.merchant.slice(0, 6)}...{invoice.merchant.slice(-4)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Invoice ID</div>
                        <div className="text-gray-300 font-mono">#{invoice.id}</div>
                    </div>
                </div>

                {!isPayerValid && web3.isConnected && (
                    <div className="bg-red-900/20 border border-red-800 p-3 rounded text-red-300 text-sm">
                        This invoice is locked to a specific payer address.
                    </div>
                )}
            </div>

            {/* Action Area */}
            {!isPaid && !isCancelled && (
                <div className="p-6 bg-dark-900 border-t border-gray-700">
                    {!web3.isConnected ? (
                        <button onClick={onConnect} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition">
                            Connect Wallet to Pay
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {!isSufficientAllowance ? (
                                <button
                                    onClick={handleApprove}
                                    disabled={processing}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                                >
                                    {processing ? "Approving..." : `Step 1: Approve gUSDT`}
                                </button>
                            ) : (
                                <button
                                    onClick={isGasless ? handlePayGasless : handlePay}
                                    disabled={processing || !isPayerValid}
                                    className="w-full bg-stable-500 hover:bg-stable-400 text-black font-bold py-3 rounded-lg transition disabled:opacity-50"
                                >
                                    {processing ? "Paying..." : "Step 2: Pay Now"}
                                </button>
                            )}
                            {isSufficientAllowance && (
                                <div className="text-center text-xs text-gray-500">
                                    Approval complete. Ready to transfer.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isCancelled && (
                <div className="p-6 bg-dark-900 border-t border-gray-700 text-center text-red-400 text-sm">
                    This invoice was cancelled by the merchant.
                </div>
            )}
        </div>
    );
};

export default PaymentPage;
