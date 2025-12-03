// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBank {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract InvoiceRegistry {
    struct Invoice {
        address merchant;
        address payer;
        uint256 amount;
        uint64 expiresAt;
        uint8 status; // 0: Pending, 1: Paid, 2: Cancelled
        bytes32 metaHash;
    }

    mapping(uint256 => Invoice) public invoices;
    uint256 public nextInvoiceId;

    // EIP-712 State
    bytes32 public DOMAIN_SEPARATOR;
    mapping(address => uint256) public nonces;
    
    // Invoice(address merchant,address payer,uint256 amount,uint64 expiresAt,bytes32 metaHash,uint256 nonce)
    bytes32 public constant INVOICE_TYPEHASH = keccak256("Invoice(address merchant,address payer,uint256 amount,uint64 expiresAt,bytes32 metaHash,uint256 nonce)");

    address public constant BANK_ADDRESS = 0x0000000000000000000000000000000000001000;

    event InvoiceCreated(uint256 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount, uint64 expiresAt, bytes32 metaHash, string metadata);
    event InvoicePaid(uint256 indexed invoiceId, address indexed payer, address indexed merchant, uint256 amount);
    event InvoiceCancelled(uint256 indexed invoiceId);

    constructor() {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("StablePay")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    // Standard Create
    function createInvoice(address _payer, uint256 _amount, uint64 _expiresAt, string calldata _metadata) external returns (uint256) {
        uint256 invoiceId = nextInvoiceId++;
        bytes32 metaHash = keccak256(bytes(_metadata));

        invoices[invoiceId] = Invoice({
            merchant: msg.sender,
            payer: _payer,
            amount: _amount,
            expiresAt: _expiresAt,
            status: 0,
            metaHash: metaHash
        });

        emit InvoiceCreated(invoiceId, msg.sender, _payer, _amount, _expiresAt, metaHash, _metadata);
        return invoiceId;
    }

    // Standard Pay
    function pay(uint256 _invoiceId) external {
        Invoice storage invoice = invoices[_invoiceId];
        require(invoice.status == 0, "Not pending");
        require(block.timestamp <= invoice.expiresAt, "Expired");
        
        // If payer is specified, enforce it
        if (invoice.payer != address(0)) {
            require(msg.sender == invoice.payer, "Wrong payer");
        }

        invoice.status = 1; // Paid
        
        require(IBank(BANK_ADDRESS).transferFrom(msg.sender, invoice.merchant, invoice.amount), "Transfer failed");
        
        emit InvoicePaid(_invoiceId, msg.sender, invoice.merchant, invoice.amount);
    }

    // Standard Cancel
    function cancelInvoice(uint256 _invoiceId) external {
        Invoice storage invoice = invoices[_invoiceId];
        require(msg.sender == invoice.merchant, "Not merchant");
        require(invoice.status == 0, "Cannot cancel");
        
        invoice.status = 2; // Cancelled
        emit InvoiceCancelled(_invoiceId);
    }

    // Helper: Verify EIP-712 Signature
    function _verifySignature(
        address _merchant,
        address _payer,
        uint256 _amount,
        uint64 _expiresAt,
        bytes32 _metaHash,
        uint256 _nonce,
        uint8 _v, bytes32 _r, bytes32 _s
    ) internal view returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                INVOICE_TYPEHASH,
                _merchant,
                _payer,
                _amount,
                _expiresAt,
                _metaHash,
                _nonce
            ))
        ));
        
        address recovered = ecrecover(digest, _v, _r, _s);
        return (recovered != address(0) && recovered == _merchant);
    }

    // Gasless Create & Pay
    function createAndPayInvoice(
        address _merchant,
        address _payer,
        uint256 _amount,
        uint64 _expiresAt,
        string calldata _metadata,
        uint8 _v, bytes32 _r, bytes32 _s
    ) external {
        require(block.timestamp <= _expiresAt, "Expired");
        if (_payer != address(0)) {
            require(msg.sender == _payer, "Wrong payer");
        }

        bytes32 metaHash = keccak256(bytes(_metadata));
        uint256 currentNonce = nonces[_merchant];
        
        // 1. Verify Signature
        require(
            _verifySignature(_merchant, _payer, _amount, _expiresAt, metaHash, currentNonce, _v, _r, _s),
            "Invalid signature"
        );
        
        // 2. Increment Nonce
        nonces[_merchant] = currentNonce + 1;

        // 3. Create Invoice & Execute Payment
        uint256 invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice(_merchant, _payer, _amount, _expiresAt, 1, metaHash);
        
        emit InvoiceCreated(invoiceId, _merchant, _payer, _amount, _expiresAt, metaHash, _metadata);
        
        require(IBank(BANK_ADDRESS).transferFrom(msg.sender, _merchant, _amount), "Transfer failed");
        emit InvoicePaid(invoiceId, msg.sender, _merchant, _amount);
    }

    function getInvoice(uint256 _invoiceId) external view returns (address merchant, address payer, uint256 amount, uint64 expiresAt, uint8 status, bytes32 metaHash) {
        Invoice memory i = invoices[_invoiceId];
        return (i.merchant, i.payer, i.amount, i.expiresAt, i.status, i.metaHash);
    }
}
