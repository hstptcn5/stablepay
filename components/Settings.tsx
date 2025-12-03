import React, { useState } from 'react';
import { Web3State } from '../types';
import { getProvider, deployRegistry } from '../services/web3Service';

interface SettingsProps {
    registryAddress: string;
    setRegistryAddress: (addr: string) => void;
    web3: Web3State;
}

const Settings: React.FC<SettingsProps> = ({ registryAddress, setRegistryAddress, web3 }) => {
    const [deploying, setDeploying] = useState(false);
    const [localAddr, setLocalAddr] = useState(registryAddress);

    const handleDeploy = async () => {
        if (!web3.isConnected) return alert("Connect wallet first");
        setDeploying(true);
        try {
            const provider = await getProvider();
            const signer = await provider.getSigner();
            const address = await deployRegistry(signer);
            setRegistryAddress(address);
            setLocalAddr(address);
            alert("Registry Contract Deployed Successfully!");
        } catch (e) {
            console.error(e);
            alert("Deployment failed. See console.");
        } finally {
            setDeploying(false);
        }
    };

    const handleSave = () => {
        setRegistryAddress(localAddr);
        alert("Address saved.");
    };

    return (
        <div className="bg-dark-800 rounded-xl p-6 border border-gray-700 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <span className="bg-stable-500 w-2 h-8 rounded-full"></span>
                System Settings
            </h2>
            
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-stable-500 mb-2">Invoice Registry Contract</h3>
                <p className="text-gray-400 text-sm mb-4">
                    To create and pay invoices, this app needs to talk to a Smart Contract on the Stable Testnet.
                    You can deploy your own instance for testing.
                </p>

                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <input 
                        type="text" 
                        value={localAddr}
                        onChange={(e) => setLocalAddr(e.target.value)}
                        placeholder="0x..."
                        className="flex-1 bg-dark-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-stable-500 focus:outline-none"
                    />
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                    >
                        Save
                    </button>
                </div>

                {!registryAddress && (
                    <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-200 p-4 rounded-lg text-sm">
                        ⚠️ No registry contract configured. The app will not function correctly until you set an address or deploy a new one.
                    </div>
                )}
            </div>

            <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-2">Deploy New Registry</h3>
                <p className="text-gray-400 text-sm mb-4">
                    Deploys the <code>InvoiceRegistry</code> contract to Stable Testnet using your wallet.
                    <br/>
                    <span className="text-xs opacity-70">Gas will be paid in gUSDT.</span>
                </p>
                <button
                    onClick={handleDeploy}
                    disabled={deploying || !web3.isConnected}
                    className={`w-full md:w-auto px-6 py-3 rounded-lg font-bold text-black transition flex items-center justify-center gap-2
                        ${deploying || !web3.isConnected ? 'bg-gray-600 cursor-not-allowed' : 'bg-stable-500 hover:bg-stable-400'}
                    `}
                >
                    {deploying ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deploying...
                        </>
                    ) : (
                        "Deploy Contract"
                    )}
                </button>
                {!web3.isConnected && <p className="mt-2 text-red-400 text-xs">Please connect wallet first.</p>}
            </div>
        </div>
    );
};

export default Settings;
