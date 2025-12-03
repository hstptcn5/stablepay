# StablePay

> Decentralized Merchant Checkout on Stable Testnet

**Official Website:** https://stable-pay.netlify.app/

StablePay is a decentralized invoice and payment system built on the **Stable Testnet**, featuring both traditional on-chain invoices and innovative **gasless invoices** using EIP-712 signatures.

## Features

### Dual Invoice System

**On-Chain Invoice**
- Traditional blockchain-based invoices
- Merchant pays gas for creation
- Payer pays gas only for payment
- Invoices stored permanently on-chain
- Can be queried, cancelled, and tracked

**Gasless Invoice (EIP-712)**
- Merchant creates invoice with **zero gas cost**
- Only requires EIP-712 signature (off-chain)
- Payer pays gas for both creation and payment in one transaction
- Invoice data embedded in shareable link
- Privacy-focused: visible only to link holders

### Payment Features

- **gUSDT Payments**: Native integration with Stable's Bank precompile
- **Smart Approval**: One-time gUSDT approval for seamless payments
- **Payment Links**: Share invoice links for easy payment collection
- **Invoice History**: Track all created invoices in dashboard
- **Expiry Management**: Set custom expiration times for invoices
- **QR Code Generation**: Display payment QR codes for mobile scanning

### User Interface

- Clean, modern dashboard for merchants
- Simplified payment page for payers
- Real-time invoice status updates
- Mobile-responsive design
- No setup required (pre-configured contract)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Blockchain**: Stable Testnet (Chain ID: 2201)
- **Smart Contracts**: Solidity 0.8.28
- **Web3**: ethers.js v6
- **Styling**: TailwindCSS
- **Build Tools**: Hardhat (compilation), Vite (bundling)
- **Deployment**: Netlify

## Installation

```bash
# Clone repository
git clone https://github.com/hstptcn5/stablepay.git
cd stablepay

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will run at `http://localhost:3002`

## Usage

**Live App:** https://stable-pay.netlify.app/

### For Merchants

1. Visit https://stable-pay.netlify.app/
2. Click "Connect Wallet" (MetaMask or compatible Web3 wallet)
3. Create an invoice using one of two methods:

   **Option A: On-Chain Invoice**
   - Fill in description, amount, and optional payer address
   - Click "Create On-Chain Invoice"
   - Confirm transaction in wallet (pays gas)
   - Copy the payment link and share with customer

   **Option B: Gasless Invoice**
   - Fill in description, amount, and optional payer address
   - Click "Create Gasless Link (Free)"
   - Sign the message in wallet (no gas required)
   - Copy link or show QR code to customer

4. Monitor invoice status in the History panel

### For Payers

1. Open the payment link received from merchant
2. Click "Connect Wallet"
3. Review invoice details (amount, description, expiry)
4. Click "Pay Now"
5. Approve gUSDT spending if first time
6. Confirm payment transaction
7. Payment complete!

## Smart Contract

**Deployed Address**: `0x5b9b95afbc73f85e680cb4bc847db72a2f249105`

**Contract Features**:
- `createInvoice()` - Create on-chain invoice
- `pay(invoiceId)` - Pay existing invoice
- `cancelInvoice(invoiceId)` - Cancel unpaid invoice
- `createAndPayInvoice()` - Gasless invoice payment (verifies EIP-712 signature)
- `nonces(address)` - Get current nonce for EIP-712 signing

**Source**: `contracts/InvoiceRegistry.sol`

**Explorer**: https://testnet.stable.xyz/address/0x5b9b95afbc73f85e680cb4bc847db72a2f249105

## Configuration

The contract address is pre-configured in `constants.ts`:

```typescript
export const DEFAULT_REGISTRY_ADDRESS = "0x5b9b95afbc73f85e680cb4bc847db72a2f249105";
```

To deploy your own instance:

```bash
# Compile contract
npm run compile

# Deploy (configure .env.local with PRIVATE_KEY first)
npm run deploy
```

## Network Details

- **Network**: Stable Testnet
- **Chain ID**: 2201
- **RPC URL**: https://rpc.testnet.stable.xyz
- **Explorer**: https://testnet.stable.xyz
- **Native Token**: gUSDT (Bank precompile at `0x0000...1000`)

## How It Works

### On-Chain Invoice Flow

```
Merchant                    Blockchain                   Payer
   |                            |                          |
   |-- createInvoice() -------->|                          |
   |    (pays gas)              |                          |
   |<---- Invoice ID -----------|                          |
   |                            |                          |
   |-------- Share Link ----------------------->|          |
   |                            |               |          |
   |                            |<-- pay(id) ---|          |
   |                            |   (pays gas)  |          |
   |<--- Receive gUSDT ---------|               |          |
```

### Gasless Invoice Flow

```
Merchant                    Browser                   Payer
   |                            |                        |
   |-- Sign EIP-712 -------->   |                        |
   |    (no gas)                |                        |
   |<--- Signature + Link ---|  |                        |
   |                            |                        |
   |-------- Share Link --------------------->|          |
   |                            |              |          |
   |                            |<-- createAndPayInvoice()|
   |                            |    (verifies sig + pay) |
   |<--- Receive gUSDT ---------|              |          |
```

## Security

- **EIP-712 Signatures**: Structured data signing for gasless invoices
- **Nonce Management**: Replay attack prevention
- **Domain Separation**: Contract-specific signature validation
- **Payer Verification**: Optional payer address restriction
- **Expiry Checks**: Time-based invoice validation

## License

MIT

## Contributing

Contributions welcome! This is a demonstration project for the Stable Testnet ecosystem.

---

Built for the Stable Testnet