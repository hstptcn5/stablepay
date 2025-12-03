export enum InvoiceStatus {
  NONE = 0,
  CREATED = 1,
  PAID = 2,
  CANCELLED = 3
}

export interface Invoice {
  id: string; // Contract returns uint256, we use string for JS safety
  merchant: string;
  payer: string; // 0x0 if open
  amount: string; // Formatted gUSDT
  expiresAt: number;
  status: InvoiceStatus;
  metaHash: string;
  description?: string; // Decoded from local storage or IPFS in a real app, storing locally for demo
}

export interface Web3State {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string; // gUSDT balance
}

export type InvoiceFormValues = {
  amount: string;
  payer: string;
  description: string;
  expiryMinutes: number;
};
