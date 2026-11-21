const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'history.json');

// Middleware để đọc JSON từ SePay gửi lên
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Hàm hỗ trợ đọc lịch sử giao dịch từ file JSON
function docLichSu() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // Nếu chưa có file, khởi tạo cấu trúc mặc định
            const duLieuMacDinh = {
                thong_tin: "Lịch sử giao dịch ngân hàng qua SePay",
                tong_so_giao_dich: 0,
                danh_sach_giao_dich: []
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(duLieuMacDinh, null, 4), 'utf8');
            return duLieuMacDinh;
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (loi) {
        console.error("Lỗi khi đọc file dữ liệu:", loi);
        return { thong_tin: "Lịch sử giao dịch", tong_so_giao_dich: 0, danh_sach_giao_dich: [] };
    }
}

// Hàm hỗ trợ ghi lịch sử giao dịch vào file JSON (Lưu trữ tuần tự không mất dữ liệu cũ)
function ghiLichSu(giaoDichMoi) {
    const duLieu = docLichSu();
    
    // Thêm giao dịch mới lên đầu danh sách để dễ theo dõi
    duLieu.danh_sach_giao_dich.unshift(giaoDichMoi);
    duLieu.tong_so_giao_dich = duLieu.danh_sach_giao_dich.length;

    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(duLieu, null, 4), 'utf8');
        console.log(`[THÀNH CÔNG] Đã lưu giao dịch mới từ mã: ${giaoDichMoi.ma_giao_dich}`);
    } catch (loi) {
        console.error("Lỗi khi ghi file dữ liệu:", loi);
    }
}

// Endpoint nhận Webhook từ SePay (URL: https://domain-cua-ban/sepay-webhook)
app.post('/sepay-webhook', (req, res) => {
    const webhookData = req.body;

    // Kiểm tra xem dữ liệu gửi lên có hợp lệ không
    if (!webhookData || Object.keys(webhookData).length === 0) {
        return res.status(400).json({ 
            trang_thai: "that_bai", 
            thong_bao: "Không tìm thấy dữ liệu gửi lên từ SePay." 
        });
    }

    console.log("Đã nhận được dữ liệu từ SePay:", webhookData);

    // Chuẩn hóa dữ liệu sang tiếng Việt đầy đủ, rõ nghĩa
    const giaoDichChuanHoa = {
        id: webhookData.id || null,
        ma_giao_dich: webhookData.referenceCode || webhookData.code || "Không có",
        thoi_gian_giao_dich: webhookData.transactionDate || new Date().toISOString(),
        so_tai_khoan_ngan_hang: webhookData.accountNumber || "Không rõ",
        ngan_hang: webhookData.gateway || "Không rõ",
        loai_giao_dich: webhookData.transferType === "in" ? "Nhận tiền" : "Chuyển tiền",
        so_tien_giao_dich: Number(webhookData.transferAmount) || 0,
        so_du_luc_do: Number(webhookData.accumulated) || 0,
        noi_dung_chuyen_khoan: webhookData.content || "Không có nội dung",
        ma_qr_hoac_ma_phu: webhookData.referenceCode || ""
    };

    // Tiến hành lưu vào file JSON
    ghiLichSu(giaoDichChuanHoa);

    // Phản hồi lại cho SePay biết là đã nhận thành công
    return res.status(200).json({ 
        trang_thai: "thanh_cong", 
        thong_bao: "Đã tiếp nhận và lưu trữ lịch sử giao dịch thành công." 
    });
});

// Endpoint API để xem trực tiếp danh sách lịch sử (URL: https://domain-cua-ban/lich-su)
app.get('/lich-su', (req, res) => {
    const duLieu = docLichSu();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(duLieu, null, 4));
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});