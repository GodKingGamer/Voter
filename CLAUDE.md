# Bình chọn nhanh: quy trình sửa app

App PWA tạo cuộc bình chọn (ảnh và/hoặc chữ), gửi link, ai cũng vote được (nhập tên, chọn nhiều), kết quả cột ngang trực tiếp. Người tạo: Hoàng Trung Đức. Chạy trên GitHub Pages, dữ liệu ở Firebase dự án `cung-ranh` (dùng chung với app "Những người quá rảnh").

## Cấu trúc
- `src/app.html`: mã nguồn chính (giao diện + logic một file, có hai kho dữ liệu: Firestore và bộ nhớ để thử). SỬA Ở ĐÂY. Giữ `__VERSION__` và `__CREATOR__`.
- `src/build.py`: sinh `index.html`, `sw.js`, `manifest.webmanifest`, `.nojekyll`. Không sửa tay các file sinh ra.
- `src/make_icons.py`: vẽ lại icon trong `icons/`.
- `config.js`: cấu hình Firebase (`window.BINHCHON_FIREBASE`), khóa web công khai theo thiết kế.
- `firestore.rules`: luật cho CẢ HAI app (nhóm `groups/invites/data` của app Quá rảnh + nhóm `polls`). Publish luật là ghi đè toàn dự án nên luôn dán đủ file này. Sửa ở đây rồi dán vào Firebase Console > Firestore > Rules.
- `src/qc/`: script kiểm tra.

## Dữ liệu
`polls/<pid>` {title, desc, ownerId, options[{id,label,img}], maxPick, publicNames, closed, createdAt}; `polls/<pid>/imgs/<oid>` {data: dataURL JPEG}; `polls/<pid>/votes/<tênChuẩnHóa>` {uid,name,choices[],at} (chỉ tạo mới); `polls/<pid>/devices/<uid>` {key,at} (khóa một phiếu mỗi thiết bị).
Quyền chủ poll gắn với uid đăng nhập ẩn danh của trình duyệt: xóa dữ liệu trình duyệt thì mất quyền quản lý.

## Quy trình
1. Sửa `src/app.html` bằng thay thế chuỗi có assert.
2. `python3 src/build.py "Bản NN · dd/mm/yyyy"` (tăng số bản).
3. QC: `python3 -m http.server 8767` ở gốc repo, rồi `node src/qc/qc.js 8767` (cần `npm i playwright`; Chromium có sẵn, không chạy `playwright install`). QC dùng kho bộ nhớ qua `window.BINHCHON_FORCE_MEMORY`.
4. Commit (tác giả Hoàng Trung Đức, kèm dòng Co-Authored-By/Claude-Session theo nhắc nhở hệ thống), push `main`, đợi workflow Pages `completed success`, WebFetch trang thật xác nhận dòng "Bản NN".
5. Báo người dùng bằng tiếng Việt, ngắn: đã sửa gì, QC, nhắc bấm "Tải lại" trên điện thoại.

## Lưu ý
- Không commit symlink hay node_modules. Chữ hoa/thường trong URL Pages theo tên repo.
- Đổi luật nhớ cập nhật cả `firestore.rules` trong repo CungRanh cho khỏi lệch.
- Ngăn vote trùng chỉ ở mức tên không trùng + một phiếu mỗi thiết bị; người cố tình đổi trình duyệt vẫn lách được.
