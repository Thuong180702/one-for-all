# one-for-all

> Thông báo macOS thật cho những web app không có ứng dụng Mac.

**Trạng thái: pre-alpha.** v0.6 build ra `.app` thật từ source và tự cài đặt
qua màn hình chào lần đầu. Chưa publish lên
npm hay Homebrew, nên các lệnh đó **chưa dùng được** — tự build lấy, xem
[Cài đặt](#cài-đặt). Xem thêm [Lộ trình](#lộ-trình).

[English →](README.md)

---

## Vấn đề

Messenger không có app cho macOS. App Zalo trên Mac chỉ là bản port hạng hai.
Tab web mail bị Chrome throttle rồi ngừng đẩy thông báo. Kết cục là bạn có một
tab ghim ở đâu đó mà:

- không bắn thông báo sau khi nằm ở background một lúc
- âm thầm mất kết nối khi Mac ngủ, và không bao giờ tự kết nối lại
- bị trình duyệt treo lại vì background throttling
- bắt bạn lục 40 tab để tìm cái vừa nhấp nháy

`one-for-all` là một app macOS nhỏ, chạy các web app đó trong container **không
bị throttle, luôn giữ kết nối**, và biến mọi thứ chúng phát ra thành **thông báo
macOS thật** — bấm vào là nhảy đúng cuộc trò chuyện.

## App làm được gì

- **Cài đặt trong một màn hình.** Lần mở đầu tiên xin quyền thông báo và mời bật
  khởi động cùng máy — cấp luôn, hoặc bỏ qua rồi vào lại từ menu bar. Sau đó chọn
  nền tảng từ lưới, đăng nhập một lần, xong. Không cần đụng terminal.
- **Thông báo native thật.** Không phải toast trong app. Đi qua Notification
  Center của macOS, nên Focus mode, Do Not Disturb, màn hình khoá và lịch sử
  thông báo đều hoạt động đúng như bạn quen dùng.
- **Bấm vào là tới đúng chỗ.** Bấm thông báo sẽ kích hoạt app, chuyển sang đúng
  service, và — nếu service cung cấp deep link — mở đúng đoạn chat, không phải
  màn hình inbox chung.
- **Giữ kết nối.** Tắt background throttling, bật power-save blocker, kèm một
  watchdog tự reload service sau khi máy ngủ/thức hoặc khi socket rớt. Đây chính
  là lý do dự án này tồn tại.
- **Mỗi service một phiên đăng nhập riêng.** Mỗi service dùng session partition
  riêng biệt của Electron, cookie không lẫn nhau. `ofa add messenger --as work`
  cho bạn tài khoản thứ hai của cùng service, đăng nhập độc lập.
- **Nằm gọn trên menu bar nếu bạn muốn.** Đặt `"windowMode": "menubar"` là app
  bỏ icon Dock và trở thành một panel mở ngay dưới icon tray.
- **Đếm tin chưa đọc trên thanh tab, menu bar và Dock.** Tổng hợp mọi service.
- **Giờ yên tĩnh đúng nghĩa.** Tắt tiếng từng service, lọc từ khoá cho/chặn,
  lịch DND, và danh sách ưu tiên xuyên qua tất cả.
- **Mọi thứ nằm ở máy bạn.** Không tài khoản, không server, không telemetry.
  Session và cấu hình nằm trên ổ đĩa của bạn.

## Service được hỗ trợ

Web app nào cũng thêm được bằng URL — `ofa add --url ...`. Không có code riêng
cho từng site: thông báo đến từ những gì trang tự phát ra qua Web Notification
API, còn số chưa đọc lấy từ regex `(N)` chung trên title. Các tên dưới đây chỉ là
preset để gõ cho nhanh `ofa add gmail`.

| Service | Thông báo | Badge chưa đọc | Deep link khi bấm |
|---|---|---|---|
| Messenger | có | có | đoạn chat |
| Gmail / Google Workspace | có | có | email |
| Outlook Web | có | có | email |
| Slack (web) | có | có | channel |
| Discord (web) | có | có | channel |
| Telegram Web | có | có | chat |
| WhatsApp Web | có | có | chat |
| Zalo Web | qua số tin chưa đọc | có | mở Zalo |
| Generic (URL bất kỳ) | nếu site dùng API | nếu site đặt `(N)` vào title | tuỳ handler của site |

Deep link không hardcode: bấm thông báo native sẽ chạy lại chính `onclick` của
trang — cái vốn đã biết mở đúng đoạn chat. Nên site nào dùng API chuẩn là chạy
được ngay, và vẫn chạy sau khi site deploy lại.

> **Zalo Web không bao giờ gọi Notification API.** Với các site kiểu này, bật
> `"notifyOnUnread": true` (preset `zalo` đã bật sẵn) là mỗi lần số tin chưa đọc
> trên tab title *tăng lên* sẽ thành một thông báo: "Zalo — 3 new messages". Bạn
> không có tên người gửi hay nội dung, vì trang không hề đưa ra — đổi lại không
> có DOM selector nào để hỏng khi Zalo deploy lại. Cờ này tự bị bỏ qua khi
> service đã dùng API thật, nên không thể thông báo trùng trên Messenger.
>
> Những dòng còn lại trong bảng mới chỉ đúng ở mức "site đó dùng API chuẩn" —
> vẫn cần test bằng tài khoản thật.

## Cài đặt

### Qua Homebrew (Khuyên dùng)

```bash
brew install --cask https://raw.githubusercontent.com/Thuong180702/one-for-all/main/Casks/one-for-all.rb
```

Hoặc thêm tap:

```bash
brew tap Thuong180702/one-for-all https://github.com/Thuong180702/one-for-all
brew install --cask one-for-all
```

### Từ nguồn (Source)

```bash
git clone https://github.com/Thuong180702/one-for-all && cd one-for-all
npm install && npm run build
cp -R dist/one-for-all.app /Applications/
```

Sau đó mở app từ Finder. Lần chạy đầu hiện màn hình chào:

1. **Notifications** — bấm *Allow* để bắn một thông báo thử, đó chính là thứ khiến
   macOS hỏi quyền. Dòng này chuyển thành *✓ Done* ngay khi macOS nhận. Nếu không
   thấy popup nào hiện lên, *Open notification settings* mở đúng trang cài đặt.
2. **Start at login** — app chỉ báo được khi nó đang chạy.
3. *Continue* (hoặc *Skip for now* — mọi thứ vẫn vào lại được từ menu bar, mục
   **Setup & Permissions…**).

Sau đó chọn nền tảng từ lưới. Thêm cái nào là app mở luôn trang đăng nhập của cái
đó; đăng nhập một lần, phiên đăng nhập giữ trên đĩa. Mở lại lưới bất cứ lúc nào
bằng nút **+** trên thanh tab.

> **Bước này bắt buộc.** macOS từ chối gửi thông báo từ một lần chạy `electron .`
> trần — nó fail với `UNErrorDomain error 1`, và im lặng hoàn toàn từ phía app.
> Một notification client cần bundle identifier riêng và chữ ký code, đó chính là
> thứ `npm run build` tạo ra. Nếu không thấy popup nào, chạy `ofa doctor` trước —
> nó kiểm tra đúng chỗ này.

`npm run build` copy sẵn Electron runtime bạn đã cài, nhét source vào, thay icon
và bundle id, rồi ad-hoc sign. Không cần thêm dependency build nào.
Yêu cầu macOS 12+ (Apple Silicon và Intel).

Sau này:

```bash
npm install -g one-for-all      # chưa publish
brew install --cask one-for-all # chưa publish
```

## Cách dùng

Thêm/gỡ service đã có sẵn trong màn hình cài đặt; CLI để dành cho script và cho
những tuỳ chọn màn hình đó không phơi ra.

```bash
one-for-all                      # mở app (hoặc focus nếu đang chạy)
one-for-all add messenger        # thêm service có sẵn cấu hình
one-for-all add messenger --as work   # tài khoản thứ hai, đăng nhập riêng
one-for-all add --url https://mail.proton.me --name "Proton Mail"
one-for-all list                 # liệt kê service đã cấu hình
one-for-all remove slack
one-for-all config               # mở config.json bằng $EDITOR
one-for-all notify "Build xong" --body "3m42s" --url https://ci.example.com
one-for-all doctor               # kiểm tra config, kết nối, DND, service bị tắt tiếng
```

`one-for-all notify` cố tình để generic: nó là một dòng lệnh để đưa bất kỳ
script, cron job hay CI hook nào vào chung luồng thông báo. Bấm vào thông báo
kiểu này sẽ mở `--url` bằng trình duyệt.

### Phím tắt

| Phím tắt | Hành động |
|---|---|
| <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd> | Bật/tắt cửa sổ (toàn cục, đổi được) |
| <kbd>⌘</kbd><kbd>1</kbd>…<kbd>9</kbd> | Nhảy tới service thứ N |
| <kbd>⌘</kbd><kbd>R</kbd> | Reload service hiện tại |
| <kbd>⌘</kbd><kbd>⇧</kbd><kbd>D</kbd> | Bật/tắt Do Not Disturb |

## Cấu hình

`~/Library/Application Support/one-for-all/config.json`

```jsonc
{
  "startAtLogin": true,
  "windowMode": "window",        // "window" | "menubar"
  "appMode": "normal",           // "normal" (đầy đủ UI) | "minimal" (chỉ thông báo)
  "globalShortcut": "Cmd+Shift+Space",
  "dnd": false,                  // ghi đè thủ công, bật/tắt từ menu bar
  "dndSchedule": [              // giờ yên tĩnh; khoảng có thể vắt qua nửa đêm
    { "from": "22:00", "to": "08:00", "days": [1,2,3,4,5] }
  ],
  "history": true,               // false = không lưu lịch sử thông báo
  "onboarded": true,             // false = lần mở sau hiện lại màn hình chào
  "notificationsOk": true,       // bật khi macOS đã nhận thông báo ít nhất 1 lần
  "ramOptimization": false,      // true = throttle tab ẩn; đánh đổi lấy RAM,
                                  // xem phần Dấu chân bộ nhớ bên dưới
  "idleSleepMinutes": 0,         // 0 = tắt; unload trang sau N phút idle
                                  // và không có tin nhắn chưa đọc
  "services": [
    {
      "id": "messenger",
      "name": "Messenger",
      "url": "https://www.messenger.com/",
      "partition": "persist:messenger",   // --as tự đặt; đổi cho tài khoản thứ 2
      "enabled": true,
      "muted": false,
      "sound": "default",                 // "Ping" / "Glass" / ...; null = im lặng
      "badge": true,                      // có tính vào badge Dock không
      "notify": {
        "allow": [],                      // regex; rỗng = cho qua hết
        "deny": ["^.*đã bày tỏ cảm xúc.*$"],
        "priority": ["Mẹ", "@here"]       // những cái này vượt qua DND
      },
      "notifyOnUnread": false,            // cho site không dùng Notification API
      "reloadIfIdleMinutes": 0,           // 0 = tắt; xem lưu ý bên dưới
      "userAgent": null                   // ghi đè nếu site chặn Electron
    }
  ]
}
```

Sửa file là app nhận ngay, không cần khởi động lại. Thêm, xoá, đổi URL service
đều có hiệu lực lúc lưu.

`days` của `dndSchedule` được so với ngày *hiện tại*, nên khoảng T2–T6
22:00–08:00 dừng lúc nửa đêm thứ Sáu chứ không tràn sang sáng thứ Bảy. Muốn tràn
thì tách thành hai khoảng.

`reloadIfIdleMinutes` reload service đã im lặng quá lâu. "Im lặng" nghĩa là không
có thông báo, không đổi title, và không có HTTP request nào hoàn tất — nhưng
frame trên WebSocket đã upgrade thì nó không thấy, nên một Messenger hoàn toàn
khoẻ vẫn có thể trông như đang idle. Vì vậy mặc định là tắt. Chỉ bật cho service
mà m đã thực sự thấy nó chết.

`ramOptimization` và `idleSleepMinutes` đều mặc định tắt, vì cả hai đánh đổi
đúng thứ app này sinh ra để làm: giữ kết nối sống khi bị ẩn — để lấy lại RAM.
`ramOptimization` cho phép Chromium throttle tab nền như một trình duyệt bình
thường. `idleSleepMinutes` unload hẳn trang của tab nền (về `about:blank`) sau
N phút idle không có tin nhắn chưa đọc; bấm lại vào tab sẽ load lại. Chỉ bật
khi việc kết nối lại chậm vài giây là chấp nhận được để đổi lấy RAM.

## Cơ chế hoạt động

```
┌──────────────────────────── Electron main ────────────────────────────┐
│                                                                       │
│   config.json ──► mỗi service 1 WebContentsView                       │
│    (fs.watch,           │                                             │
│     hot-reload)         ├──► session persist:<id>                     │
│                         │     (cookie/storage tách biệt)              │
│                         │                                             │
│   Watchdog ◄────────────┤  did-fail-load, power-monitor resume,       │
│  (ngủ/thức,             │  bộ đếm idle                                │
│   reload khi idle)      ▼                                             │
│                    preload.js  (contextIsolation, sandbox)            │
│                      • tiêm shim Notification vào main world          │
│                      • poll document.title tìm "(N)"                  │
│                         │ IPC                                         │
│                         ▼                                             │
│   Tray ─┐          notify()  ──────────────► electron.Notification    │
│   Dock ─┼──────────  • allow/deny/priority       (NSUser-             │
│   Tabs ─┘            • DND + lịch                 Notification thật)  │
│                      • lịch sử (200 gần nhất)         │               │
│                                                       ▼               │
│                            bấm ──► focus + đổi service ──►            │
│                                     chạy lại onclick của trang        │
└───────────────────────────────────────────────────────────────────────┘
```

Ba thứ gánh phần lớn công việc:

1. **Shim Notification được tiêm vào main world của trang.** Nó giữ nguyên bề mặt
   API (nên trang tưởng đã thành công) nhưng thay vì vẽ gì đó, nó gửi title và
   body qua IPC, và main process mới quyết định cái gì thành thông báo macOS. Vì
   `contextIsolation` đang bật, preload không thể gán thẳng `window.Notification`
   — nó phải tiêm shim bằng `webFrame.executeJavaScript` rồi nói chuyện qua kênh
   `contextBridge`.
2. **`session.setPermissionRequestHandler` tự động cấp quyền** `notifications`
   cho các service đã cấu hình, nên bạn không bao giờ thấy popup xin quyền của
   site, và site cũng không rơi vào chế độ "đã chặn thông báo".
3. **App được báo đúng lúc nào nó đang bị che.** Chromium coi một view đang host
   là "visible" kể cả khi cửa sổ đã ẩn, mà các app chat chỉ bắn thông báo khi
   document đang hidden — nên app tự báo trạng thái thật cho từng service, nếu
   không Messenger sẽ không bao giờ thông báo.
4. **`webContents.setBackgroundThrottling(false)` (mặc định của `ramOptimization`)
   + `powerSaveBlocker`** giữ cho WebSocket sống khi cửa sổ bị ẩn hoặc máy rảnh.
   Một tab trình duyệt không làm được điều này; đó chính xác là khoảng trống mà
   app này lấp.

Bấm thông báo native sẽ gửi ngược cho shim id của notification đã tạo ra nó, và
shim chạy `onclick` của chính object đó. Toàn bộ cơ chế deep link chỉ có vậy —
không có template URL riêng cho từng site nào phải bảo trì.

## So sánh

| | one-for-all | Ferdium / Rambox | Tab trình duyệt | Beeper |
|---|---|---|---|---|
| Thông báo macOS native | có | có | bị throttle | có |
| Sống sót qua ngủ/throttle | thiết kế cho việc này | phần lớn | không | có |
| Hỗ trợ Zalo | có | recipe cộng đồng | — | không |
| Chạy hoàn toàn cục bộ | có | có | có | không (server bridge) |
| Tài nguyên | 1 process/service | tương tự | — | — |
| Mã nguồn mở | MIT | Ferdium: Apache-2.0 | — | một phần |

Nếu Ferdium đã đủ dùng cho bạn thì **cứ dùng Ferdium** — nó trưởng thành hơn và
có nhiều recipe hơn. Dự án này sinh ra cho trường hợp hẹp hơn: Zalo/Messenger
trên macOS, hành vi kết nối lại quyết liệt, một CLI `notify` để script hoá, và
một bề mặt mã nhỏ hơn nhiều để tự đọc/kiểm tra.

## Riêng tư & bảo mật

- Renderer chạy với `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`. Preload chỉ mở đúng một kênh IPC, một chiều.
- App không bao giờ đọc, lưu hay trung chuyển thông tin đăng nhập — bạn đăng
  nhập thẳng vào site thật trong session riêng của nó, y như trên trình duyệt.
- Không gọi mạng tới bất cứ đâu ngoài các service bạn cấu hình. Không analytics,
  không crash report, không ping kiểm tra cập nhật trừ khi bạn bật.
- Lịch sử thông báo (200 gần nhất) chỉ nằm trong bộ nhớ và mất khi tắt app —
  không ghi gì xuống đĩa. Đặt `"history": false` nếu không muốn lưu gì cả.
- Cấu hình và session: `~/Library/Application Support/one-for-all/`.

## Lộ trình

- [x] **v0.1** — Vỏ Electron, session riêng từng service, shim Notification,
      thông báo native, click-through, Tray + Dock badge, `config.json`,
      reload khi ngủ/thức, bật/tắt DND, lọc từ khoá.
- [x] **v0.2** — Thanh tab, hot-reload config, lịch DND, watchdog reload khi
      idle, lịch sử thông báo, CLI `notify`, `doctor`.
- [x] **v0.3** — Thông báo cho site không dùng Notification API (Zalo) bằng
      chênh lệch số tin chưa đọc thay vì DOM watcher, chế độ chỉ-menubar,
      âm thanh riêng từng service, đa tài khoản qua `ofa add <preset> --as`.
- [x] **v0.4** — Đóng gói thành `.app` thật (bundle id riêng, icon riêng, ad-hoc
      sign) — hoá ra đây mới là thứ khiến thông báo chạy được: macOS chặn sạch
      thông báo từ `electron .` trần. Kèm `ofa doctor` báo đúng lỗi này, và sửa
      `ofa notify` (macOS `open --args` đảo thứ tự argv nên payload bị lạc).
- [x] **v0.5** — Màn hình chào lần đầu: thử thông báo, lưới nền tảng bấm-là-thêm,
      nút gỡ, và thêm URL bất kỳ. Thêm xong là nhảy thẳng vào trang đăng nhập.
      Không còn phải học CLI mới dùng được app.
- [x] **v0.6** — Màn hình chào xin quyền (thông báo, khởi động cùng máy) với nút
      bỏ qua, vào lại được từ tray; và cắt bớt phần chạy nền: huỷ hẳn renderer của
      màn hình cài đặt khi đóng, tắt spellcheck, giới hạn disk cache 64 MB.
- [ ] **v0.7** — Adapter không dùng webview: IMAP IDLE, RSS, poller HTTP/webhook
      — cho những nguồn không có web UI dùng được. (Vốn định làm ở v0.4, dời lại
      vì đóng gói quan trọng hơn hẳn.)
- [ ] **Sau nữa** — build đã ký + notarize, Homebrew cask, tự cập nhật, plugin
      API để recipe sống ngoài repo này.

## Dấu chân bộ nhớ

Một service, đóng cửa sổ, để yên: khoảng **5 tiến trình** — main, GPU, network,
thanh tab, và chính service đó. Thanh tab và màn hình cài đặt là HTML thuần không
framework, và renderer của màn hình cài đặt bị huỷ ngay khi đóng.

Phần lớn bộ nhớ là của chính web app bạn nhờ nó chạy — bundle của Messenger vốn
đã vài trăm MB trên trình duyệt nào cũng vậy, và Chromium còn tách các frame khác
origin ra tiến trình riêng. Phần app tự quyết thì giữ nhỏ: disk cache tối đa
64 MB, tắt spellcheck, mỗi service một vòng đọc title 2 giây, watchdog một phút
tick một lần. Không có gì chạy theo từng tin nhắn ngoài chính thông báo.

Site isolation cố tình để nguyên. Tắt nó đi thì gộp được đống tiến trình frame
kia lại, nhưng đó chính là lớp chặn không cho script của site này đọc bộ nhớ
phiên đăng nhập của site khác — mà app này sinh ra để giữ nhiều phiên đăng nhập
cùng lúc.

Cố tình **không** làm: hỗ trợ Windows/Linux (dùng API riêng của macOS mới là
điểm mấu chốt), UI gửi tin nhắn (bản thân web app đã là cái đó rồi), bất kỳ
thành phần chạy trên server nào.

## Đóng góp

Đóng góp giá trị nhất lúc này là **test bằng tài khoản thật** cho từng service
trong bảng. Nếu một site không lên thông báo, phần cần xem là
[`src/preload.js`](src/preload.js) — shim Notification và vòng poll title.

Thêm một service mới thì chỉ cần một dòng trong
[`src/presets.js`](src/presets.js) — không cần code riêng.

```bash
git clone https://github.com/Thuong180702/one-for-all
cd one-for-all
npm install
npm run dev          # chạy kèm devtools
npm test
```

## Giấy phép

MIT
