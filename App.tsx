import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { connectWallet, getProvider, getBankContract } from './services/web3Service';
import { ethers } from 'ethers';
import { Web3State } from './types';
import { DEFAULT_REGISTRY_ADDRESS } from './constants';
import MerchantDashboard from './components/MerchantDashboard';
import PaymentPage from './components/PaymentPage';
import Settings from './components/Settings';

// Navigation Component
const Navbar = ({ web3, onConnect }: { web3: Web3State, onConnect: () => void }) => {
    const location = useLocation();

    // Hide navbar on payment pages
    if (location.pathname.startsWith('/pay')) {
        return null;
    }

    return (
        <nav className="bg-stable-900 border-b border-stable-600 px-4 py-3 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="text-stable-500 font-bold text-xl tracking-tight">StablePay</div>
            </div>
            <div className="flex items-center gap-3">
                <div className="text-xs text-stable-500 font-mono hidden sm:block">
                    {web3.balance && `Balance: ${Number(web3.balance).toFixed(2)} gUSDT`}
                </div>
                <button
                    onClick={onConnect}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${web3.isConnected ? 'bg-stable-900 border border-stable-500 text-stable-500' : 'bg-stable-500 text-black hover:bg-stable-400'}`}
                >
                    {web3.isConnected && web3.address
                        ? `${web3.address.slice(0, 6)}...${web3.address.slice(-4)}`
                        : "Connect Wallet"
                    }
                </button>
            </div>
        </nav>
    );
};

const App: React.FC = () => {
    const [web3, setWeb3] = useState<Web3State>({
        isConnected: false,
        address: null,
        chainId: null,
        balance: '0'
    });

    const [registryAddress, setRegistryAddress] = useState<string>(() => {
        // Use localStorage first, fallback to default constant
        return localStorage.getItem('stable_invoice_registry') || DEFAULT_REGISTRY_ADDRESS;
    });

    const handleConnect = async () => {
        try {
            const signer = await connectWallet();
            const address = await signer.getAddress();
            const provider = signer.provider;
            const network = await provider?.getNetwork();

            // Get Balance
            const bank = getBankContract(signer);
            const balanceWei = await bank.balanceOf(address);

            setWeb3({
                isConnected: true,
                address,
                chainId: network ? Number(network.chainId) : null,
                balance: ethers.formatUnits(balanceWei, 18)
            });
        } catch (err) {
            console.error("Connection failed", err);
            alert("Failed to connect wallet. Ensure you are on Stable Testnet.");
        }
    };

    // Auto connect if previously connected
    useEffect(() => {
        if ((window as any).ethereum && (window as any).ethereum.selectedAddress) {
            handleConnect();
        }

        // Listen for account changes
        if ((window as any).ethereum) {
            (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) handleConnect();
                else setWeb3(prev => ({ ...prev, isConnected: false, address: null }));
            });
        }
    }, []);

    const updateRegistry = (addr: string) => {
        setRegistryAddress(addr);
        localStorage.setItem('stable_invoice_registry', addr);
    };

    return (
        <HashRouter>
            <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-stable-500 selection:text-black">
                <Navbar web3={web3} onConnect={handleConnect} />

                <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
                    <Routes>
                        <Route path="/" element={
                            <MerchantDashboard
                                web3={web3}
                                registryAddress={registryAddress}
                            />
                        } />
                        <Route path="/pay/:invoiceId" element={
                            <PaymentPage
                                web3={web3}
                                registryAddress={registryAddress}
                                onConnect={handleConnect}
                            />
                        } />
                        <Route path="/pay-gasless" element={
                            <PaymentPage
                                web3={web3}
                                registryAddress={registryAddress}
                                onConnect={handleConnect}
                            />
                        } />
                        <Route path="/settings" element={
                            <Settings
                                registryAddress={registryAddress}
                                setRegistryAddress={updateRegistry}
                                web3={web3}
                            />
                        } />
                    </Routes>
                </div>
            </div>
        </HashRouter>
    );
};

export default App;