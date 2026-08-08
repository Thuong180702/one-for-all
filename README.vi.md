<div align="center">

# ⚡ notihub

### Trung Tâm Thông Báo Native macOS & Ứng Dụng Đa Nền Tảng Siêu Nhẹ

[![Release](https://img.shields.io/github/v/release/Thuong180702/notihub?style=flat-macro&color=007AFF)](https://github.com/Thuong180702/notihub/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-black?style=flat-macro&logo=apple)](https://github.com/Thuong180702/notihub)
[![Homebrew](https://img.shields.io/badge/homebrew-cask-orange?style=flat-macro&logo=homebrew)](https://github.com/Thuong180702/notihub)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*Biến tất cả công cụ nhắn tin & làm việc web (**Messenger, Zalo, Gmail, Slack, Telegram, WhatsApp**) thành ứng dụng macOS native hiệu năng cao với thông báo tức thì, icon favicon chuẩn web và không tốn pin chạy nền.*

[English](README.md) • [Tiếng Việt](README.vi.md)

</div>

---

## 🌟 Tại sao chọn `notihub`?

Các trình duyệt như Chrome và Safari thường xuyên tự động tạm dừng (throttle) các tab ẩn chạy nền, dẫn đến tình trạng bỏ lỡ tin nhắn, rớt kết nối Socket, im lặng mất kết nối và ngốn rất nhiều RAM. Trong khi đó, các ứng dụng nhắn tin web phổ biến (như Messenger hay Zalo) thường không có app native chuẩn cho Mac.

`notihub` giải quyết triệt để vấn đề này bằng cách đưa mỗi ứng dụng web vào một container riêng biệt luôn giữ kết nối, chuyển đổi mọi thông báo thành **popup Notification Center gốc của macOS**, hỗ trợ nhảy trực tiếp vào đoạn chat và tối ưu bộ nhớ RAM ở mức cực thấp.

---

## 🔥 Tính Năng Nổi Bật

- 🪟 **Chế Độ Cửa Sổ Linh Hoạt (Window Mode)**: Chuyển đổi tức thì giữa **Standard Desktop Window** (cửa sổ chuẩn có Dock icon) và **Menu Bar Panel** (khung mờ đính thanh trạng thái) trực tiếp từ Settings.
- ⌨️ **Tùy Chỉnh Phím Tắt Toàn Cục**: Tự do cài đặt phím tắt riêng (ví dụ: `Cmd+Shift+Space`, `Alt+Space`, `Cmd+Alt+M`) để ẩn/hiện nhanh ứng dụng từ bất kỳ đâu.
- 🔔 **Thông Báo Native macOS Thật**: Tích hợp trực tiếp với Notification Center của macOS — tương thích hoàn toàn với Focus Mode, Do Not Disturb, âm thanh hệ thống và hiển thị đúng Logo riêng biệt cho từng ứng dụng.
- 🎯 **Nhảy Trực Tiếp Vào Đoạn Chat (Deep-Link)**: Nhấp vào thông báo sẽ mở ngay lập tức đúng cuộc trò chuyện hoặc email cụ thể.
- 🌐 **Thêm Web App Tùy Chỉnh & Favicon Thực**: Tự động tải favicon sắc nét cho các preset và form thêm ứng dụng Web tùy chỉnh giao diện hiện đại.
- 🎛️ **Menu Chuột Phải & Quản Lý Theo Dịch Vụ**: Chuột phải vào Tab để Bật/Tắt thông báo, ẩn badge đếm số, tải lại trang hoặc chỉnh sửa cài đặt riêng cho từng app.
- 💤 **Tự Động Tạm Ngủ Giải Phóng RAM**: Tự động giải phóng bộ nhớ cho các tab ẩn sau N phút không hoạt động mà không làm mất tin nhắn chưa đọc.
- 💎 **Giao Diện Glassmorphic Hiện Đại**: Thiết kế mờ hiệu ứng kính sang trọng, thẻ ứng dụng trực quan, bộ lọc tìm kiếm tức thì và chuyển cảnh mượt mà.
- 🔒 **Đa Tài Khoản & Session Tách Biệt**: Đăng nhập nhiều tài khoản cùng lúc (`notihub add messenger --as work`) mà không lo lẫn lộn cookie.
- ⚡ **Chế Độ Chạy Nền Minimal**: Chạy ẩn hoàn toàn dưới dạng Notification Hub & Menu Bar Tray mà không cần hiển thị khung webview.
- 🛡️ **100% Bảo Mật & Mã Nguồn Mở**: Không theo dõi, không máy chủ trung gian, không telemetry. Toàn bộ dữ liệu nằm hoàn toàn trên máy Mac của bạn.

---

## ⚡ Chế Độ Minimal & Tối Ưu RAM Siêu Nhẹ

`notihub` được thiết kế từ gốc nhằm tối ưu hóa tài nguyên phần cứng máy Mac. Ngoài việc quản lý tab thông thường, ứng dụng cung cấp chế độ **Minimal Mode** chuyên biệt:

- 🚀 **Chạy Ẩn Không Giao Diện Cầu Kỳ**: Khi bật **Minimal Mode**, ứng dụng ẩn hoàn toàn khung hiển thị tab webview nặng nề. App hoạt động như một Notification Daemon siêu nhẹ chạy nền trong Menu Bar, tiết kiệm tới **80% bộ nhớ RAM**.
- 📋 **Bảng Lịch Sử Thông Báo Trực Quan**: Ở chế độ Minimal, bấm vào icon Tray trên Menu Bar hoặc dùng phím tắt toàn cục sẽ mở **Bảng Lịch Sử Thông Báo** hiển thị các tin nhắn gần đây cùng icon thương hiệu, thời gian nhận tin và nút nhảy trực tiếp vào cuộc trò chuyện.
- 💤 **Tự Động Tạm Ngủ Tab Rảnh (Idle Sleep Watchdog)**: Tùy chỉnh giải phóng RAM cho các tab rảnh sau 5p, 10p, 15p, 30p, 60p hoặc số phút tự nhập. Tab đi ngủ sẽ giải phóng toàn bộ RAM cho tới khi bạn bấm vào lại, nhưng vẫn giữ thông báo tin nhắn chưa đọc 100%.
- 🔋 **Tối Ưu Pin & Tiến Trình Nền**: Tự động dừng các animation DOM và canvas không cần thiết của các tab ẩn mà không làm rớt kết nối Socket.

---

## 📦 Cài Đặt Nhanh

### Cách 1: Qua Homebrew (Khuyên dùng)

```bash
brew tap thuong180702/notihub
brew install --cask notihub
```

### Cách 2: Qua npm (CLI đi kèm)

```bash
npm install -g @thuong180702/notihub
```

Cài CLI `notihub` (`notihub add`, `notihub list`, `notihub notify`, …). Nên dùng kèm Cách 1 ở trên để có bản app đóng gói — macOS chặn thông báo từ Electron chạy chưa đóng gói, nên nếu chưa cài cask Homebrew, CLI sẽ fallback về cửa sổ Electron dev-mode không gửi được thông báo.

### Cách 3: Tải Trực Tiếp Bản Build `.app`

1. Tải bản nén mới nhất từ [GitHub Latest Releases](https://github.com/Thuong180702/notihub/releases/latest).
2. Giải nén và kéo file `notihub.app` vào thư mục `/Applications`.

### Cách 4: Biên Dịch Từ Mã Nguồn (Source)

```bash
git clone https://github.com/Thuong180702/notihub.git
cd notihub
npm install
npm run build
cp -R dist/notihub.app /Applications/
```

---

## ⚡ Các Ứng Dụng Hỗ Trợ

`notihub` hỗ trợ sẵn tất cả các nền tảng phổ biến và **bất kỳ địa chỉ Web URL tùy chỉnh nào**:

| Dịch vụ | Thông báo Native | Badge Tin Chưa Đọc | Deep Link Đoạn Chat | Favicon Thực Tế |
|---|---|---|---|---|
| **Messenger** | ✅ Có | ✅ Có | ✅ Đoạn chat | 🌐 Chính thức |
| **Zalo Web** | ✅ Qua Delta Tin | ✅ Có | ✅ Focus App | 🌐 Chính thức |
| **Gmail / Workspace** | ✅ Có | ✅ Có | ✅ Email | 🌐 Chính thức |
| **Outlook Web** | ✅ Có | ✅ Có | ✅ Email | 🌐 Chính thức |
| **Slack Web** | ✅ Có | ✅ Có | ✅ Channel | 🌐 Chính thức |
| **Discord Web** | ✅ Có | ✅ Có | ✅ Channel | 🌐 Chính thức |
| **Telegram Web** | ✅ Có | ✅ Có | ✅ Chat | 🌐 Chính thức |
| **WhatsApp Web** | ✅ Có | ✅ Có | ✅ Chat | 🌐 Chính thức |
| **Trang Web Tùy Chỉnh** | ✅ Web API | ✅ Title Regex | ✅ Web Handler | 🌐 Favicon API |

---

## ⌨️ Phím Tắt Tiện Lợi

| Phím tắt | Hành động |
|---|---|
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>Space</kbd> | Bật / Ẩn cửa sổ ứng dụng (Phím tắt toàn cục) |
| <kbd>⌘</kbd> <kbd>1</kbd> … <kbd>9</kbd> | Nhảy trực tiếp tới Tab dịch vụ N |
| <kbd>⌘</kbd> <kbd>R</kbd> | Tải lại trang dịch vụ hiện tại |
| <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>D</kbd> | Bật / Tắt chế độ Không Làm Phiền (DND) |

---

## 💻 Lệnh CLI Đồng Hành

`notihub` đi kèm bộ công cụ dòng lệnh mạnh mẽ hỗ trợ tự động hóa và viết script:

```bash
notihub                           # Mở hoặc focus ứng dụng
notihub add messenger             # Thêm dịch vụ preset
notihub add messenger --as work   # Thêm tài khoản thứ 2 độc lập
notihub add --url https://proton.me --name "Proton Mail"
notihub list                      # Liệt kê tất cả dịch vụ đang chạy
notihub remove slack              # Gỡ bỏ một dịch vụ
notihub notify "Build Hoàn Tất" --body "Đã triển khai thành công" --url https://ci.example.com
notihub doctor                    # Kiểm tra quyền thông báo & cấu hình
```

---

## 🤝 Đóng Góp Phát Triển

Mọi đóng góp đều được hoan nghênh! Hãy gửi Issue, Yêu cầu tính năng hoặc Pull Request trên GitHub.

1. Fork dự án
2. Tạo Nhánh Tính Năng (`git checkout -b feature/AmazingFeature`)
3. Commit Thay Đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên Nhánh (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

---

## 📜 Giấy Phép

Phát hành theo giấy phép **MIT License**. Xem `LICENSE` để biết thêm chi tiết.

<div align="center">
  <sub>Phát triển với ❤️ dành cho người dùng macOS bởi <a href="https://github.com/Thuong180702">Thuong180702</a></sub>
</div>
