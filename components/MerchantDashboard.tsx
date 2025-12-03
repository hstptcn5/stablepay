import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Web3State, Invoice, InvoiceStatus } from '../types';
import { getProvider, createInvoice, cancelInvoice, getMerchantInvoices, signInvoice } from '../services/web3Service';
import { generateInvoiceDetails } from '../services/geminiService';
import { Link } from 'react-router-dom';

interface DashboardProps {
    web3: Web3State;
    registryAddress: string;
}

const MerchantDashboard: React.FC<DashboardProps> = ({ web3, registryAddress }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [payer, setPayer] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
    const [gaslessLink, setGaslessLink] = useState<string>('');

    // Helper: Refresh List
    const refreshInvoices = useCallback(async () => {
        if (!web3.address || !registryAddress || !web3.isConnected) return;
        try {
            const provider = await getProvider();
            const invoices = await getMerchantInvoices(registryAddress, web3.address, provider);
            setRecentInvoices(invoices);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [web3.address, registryAddress, web3.isConnected]);

    useEffect(() => {
        refreshInvoices();
        const interval = setInterval(refreshInvoices, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [refreshInvoices]);

    const handleAiDraft = async () => {
        if (!description) return;
        setAiLoading(true);
        try {
            const result = await generateInvoiceDetails(description);
            setDescription(result.description);
            if (parseFloat(result.suggestedAmount) > 0) {
                setAmount(result.suggestedAmount);
            }
        } finally {
            setAiLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!web3.isConnected || !registryAddress) return alert("Connect wallet & check settings");

        setLoading(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();

            // 1. Prepare Metadata
            // We store the JSON string on chain in the Event (Metadata-in-Event)
            const metaObj = {
                d: description,
                t: Date.now()
            };
            const metaString = JSON.stringify(metaObj);

            // 2. Call Contract
            // The contract will Hash this string for state, and Emit the string in logs
            const txReceipt = await createInvoice(registryAddress, signer, amount, payer || ethers.ZeroAddress, 60, metaString);

            setAmount('');
            setDescription('');

            // 3. Refresh List immediately
            await refreshInvoices();
            alert(`Invoice created successfully! Check list below.`);

        } catch (e: any) {
            console.error(e);
            alert("Error creating invoice: " + (e.reason || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGasless = async () => {
        if (!web3.isConnected || !registryAddress) return alert("Connect wallet & check settings");
        if (!amount || !description) return alert("Enter amount and description");

        setLoading(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();
            const merchant = await signer.getAddress();

            const metaObj = { d: description, t: Date.now() };
            const metaString = JSON.stringify(metaObj);
            const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 hours

            const invoiceData = {
                payer: payer || ethers.ZeroAddress,
                amount: amount,
                expiresAt: expiresAt,
                metadataString: metaString
            };

            const { signature, nonce } = await signInvoice(registryAddress, signer, invoiceData);

            // Generate Link
            // Params: merchant, amount, expires, meta, sig, nonce (optional for display)
            const params = new URLSearchParams();
            params.set('merchant', merchant);
            params.set('amount', amount);
            params.set('expires', expiresAt.toString());
            params.set('meta', btoa(metaString)); // Base64 encode metadata
            params.set('sig', signature);
            params.set('registry', registryAddress); // Include contract address
            if (payer) params.set('payer', payer);

            const link = `${window.location.origin}/#/pay-gasless?${params.toString()}`;
            setGaslessLink(link);

        } catch (e: any) {
            console.error(e);
            alert("Error signing invoice: " + (e.reason || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (invoiceId: string) => {
        if (!confirm("Are you sure you want to cancel this invoice?")) return;
        setCancellingId(invoiceId);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();
            await cancelInvoice(registryAddress, signer, invoiceId);
            await refreshInvoices();
            alert("Invoice cancelled.");
        } catch (e: any) {
            alert("Cancel failed: " + e.message);
        } finally {
            setCancellingId(null);
        }
    };

    // Generate the URL-safe Base64 data from the description stored on-chain
    const generateEncodedLink = (id: string, desc: string) => {
        const metaObj = { d: desc };
        const json = JSON.stringify(metaObj);
        const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `${window.location.origin}/#/pay/${id}?m=${b64}`;
    };

    if (!registryAddress) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-dark-800 rounded-xl border border-gray-700">
                <h2 className="text-xl text-white mb-4">Setup Required</h2>
                <Link to="/settings" className="bg-stable-500 px-6 py-2 rounded-lg text-black font-bold hover:bg-stable-400">
                    Configure Contract
                </Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Invoice Form */}
            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700 shadow-xl h-fit">
                <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                    <span className="bg-stable-500 w-2 h-8 rounded-full"></span>
                    Create Invoice
                </h2>

                <form onSubmit={handleCreate} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. 2x Consulting Hours"
                                className="flex-1 bg-dark-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-stable-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAiDraft}
                                disabled={aiLoading || !description}
                                className="px-3 py-2 bg-purple-600/20 text-purple-400 border border-purple-600/50 rounded-lg hover:bg-purple-600/30 transition text-sm"
                            >
                                {aiLoading ? "Thinking..." : "✨ AI Draft"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Description is stored on-chain (in events). No database required.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Amount (gUSDT)</label>
                        <input
                            type="number"
                            step="0.000001"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-dark-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-stable-500 focus:outline-none font-mono text-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Payer Address (Optional)</label>
                        <input
                            type="text"
                            value={payer}
                            onChange={(e) => setPayer(e.target.value)}
                            placeholder="0x... (Leave empty for public invoice)"
                            className="w-full bg-dark-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-stable-500 focus:outline-none text-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !web3.isConnected}
                        className={`w-full py-3 rounded-lg font-bold text-black transition 
                            ${loading || !web3.isConnected ? 'bg-gray-600 cursor-not-allowed' : 'bg-stable-500 hover:bg-stable-400'}
                        `}
                    >
                        {loading ? "Confirming on Stable..." : "Create On-Chain Invoice"}
                    </button>

                    <button
                        type="button"
                        onClick={handleCreateGasless}
                        disabled={loading || !web3.isConnected}
                        className={`w-full py-3 rounded-lg font-bold text-black transition border-2 border-stable-500
                            ${loading || !web3.isConnected ? 'bg-gray-600 border-gray-600 cursor-not-allowed' : 'bg-transparent text-stable-500 hover:bg-stable-500/10'}
                        `}
                    >
                        {loading ? "Signing..." : "Create Gasless Link (Free)"}
                    </button>

                    {gaslessLink && (
                        <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                            <div className="text-xs text-green-400 mb-2 font-semibold">✓ Gasless Link Created!</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={gaslessLink}
                                    readOnly
                                    onClick={(e) => e.currentTarget.select()}
                                    className="flex-1 bg-dark-900 border border-green-600 rounded px-3 py-2 text-white text-xs font-mono"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(gaslessLink);
                                        alert('Copied to clipboard!');
                                    }}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition"
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">Share this link with the payer. No gas fee required!</div>
                        </div>
                    )}
                </form>
            </div>

            {/* Recent List */}
            <div className="bg-dark-800 rounded-xl p-6 border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">History</h2>
                    <button onClick={refreshInvoices} className="text-sm text-stable-500 hover:text-white">↻ Refresh</button>
                </div>

                {recentInvoices.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No invoices found on-chain.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {recentInvoices.map((inv) => (
                            <div key={inv.id} className="bg-dark-900 p-4 rounded-lg border border-gray-700 hover:border-stable-500/30 transition">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-mono font-bold">#{inv.id}</span>
                                            {/* Status Badges */}
                                            {inv.status === InvoiceStatus.PAID && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded">PAID</span>}
                                            {inv.status === InvoiceStatus.CREATED && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded">PENDING</span>}
                                            {inv.status === InvoiceStatus.CANCELLED && <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded">CANCELLED</span>}
                                        </div>
                                        <div className="text-sm text-gray-300 mt-1 font-medium">{inv.description}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-stable-500 font-bold">{inv.amount} gUSDT</div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(inv.expiresAt * 1000).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                                    {inv.status === InvoiceStatus.CREATED && (
                                        <button
                                            onClick={() => handleCancel(inv.id)}
                                            disabled={cancellingId === inv.id}
                                            className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-900 transition"
                                        >
                                            {cancellingId === inv.id ? "Cancelling..." : "Cancel"}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            // Directly use the description from On-Chain logs! No prompt needed.
                                            const link = generateEncodedLink(inv.id, inv.description || "Invoice");
                                            navigator.clipboard.writeText(link);
                                            alert("Link copied! (Description embedded)");
                                        }}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 rounded transition text-center"
                                    >
                                        Copy Link
                                    </button>

                                    <Link to={`/pay/${inv.id}`} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition">
                                        View
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MerchantDashboard;