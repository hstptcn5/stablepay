# Tiến độ dự án StablePay (MVP)

## ✅ Các tính năng đã hoàn thành
1. **Kết nối Wallet & Stable Testnet**:
   - Tự động phát hiện và thêm mạng Stable Testnet (Chain ID 2201).
   - Tương tác trực tiếp với **Bank Precompile** (0x...1000) như một ERC-20 token (gUSDT).

2. **Smart Contract (InvoiceRegistry)**:
   - Logic: Create -> Approve -> Pay -> Cancel.
   - **Cải tiến**: Lưu trữ Metadata (Mô tả, Order ID) trực tiếp trong Event Logs (`InvoiceCreated`).
   - **Security**: Contract tự tính Hash của metadata on-chain để đảm bảo tính toàn vẹn dữ liệu.

3. **Merchant Dashboard (Serverless)**:
   - **History**: Reconstruct toàn bộ lịch sử hoá đơn từ Blockchain Event Logs. Không cần Database, không cần LocalStorage.
   - **Metadata**: Tự động lấy mô tả từ on-chain logs để tạo link chia sẻ. **Không còn cần nhập lại mô tả thủ công**.
   - **AI**: Gemini AI tích hợp để draft nội dung hoá đơn chuyên nghiệp.

4. **Trang Thanh toán (Payment Page)**:
   - **Realtime**: Cập nhật trạng thái (Paid/Cancelled) ngay lập tức.
   - **Verification**: Tự động verify nội dung hoá đơn (Hash từ URL vs Hash on-chain) để hiện badge "Verified on-chain".

---

## 🚧 Các điểm cần lưu ý khi Demo

### 1. Tốc độ Indexing
- Dashboard hiện tại quét logs từ block 0 (`eth_getLogs`).
- **Trạng thái**: Hoạt động rất nhanh trên Testnet.
- **Tương lai**: Khi mainnet có hàng triệu block, cần tối ưu scan theo range (ví dụ: `fromBlock: latest - 10000`).

### 2. Sự kiện "Metadata-in-Event"
- Dữ liệu mô tả hoá đơn được lưu vĩnh viễn trên blockchain logs.
- Ưu điểm: Link thanh toán luôn có thể tái tạo lại được mà không cần backend trung gian.

---

## 📅 Roadmap (Phase 2)
1. **Gasless Invoice**:
   - Merchant ký off-chain (EIP-712).
   - Payer trả gas khi thực hiện thanh toán.
2. **1-Click Checkout (EIP-7702)**:
   - Sử dụng tính năng mới của Stable để batch transaction (Approve + Pay) trong 1 lần ký.
3. **Advanced Indexing**:
   - Tích hợp The Graph hoặc Goldsky để query/filter lịch sử nhanh hơn khi scale.