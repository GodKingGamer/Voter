// Dùng: python3 -m http.server 8767 (ở gốc repo) rồi node src/qc/qc.js 8767 [thư mục ảnh thử]
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const port = process.argv[2] || '8767', imgDir = process.argv[3] || '/mnt/user-data/uploads';
const base = `http://localhost:${port}/`;
const shots = path.join(__dirname, '../../build/qc'); fs.mkdirSync(shots, { recursive: true });
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const imgs = fs.readdirSync(imgDir).filter(f => /\.(png|jpe?g)$/i.test(f)).slice(0, 5).map(f => path.join(imgDir, f));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(() => { window.BINHCHON_FORCE_MEMORY = true; });
  const errors = []; const mk = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e))); return p; };
  const noOverflow = async (p, label) => ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'không tràn ngang: ' + label);

  // ---- Dán và kéo thả ảnh
  const dz = await mk(); await dz.goto(base + '#new'); await dz.waitForSelector('#t');
  const mkFiles = n => dz.evaluate(async n => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); for (let i = 0; i < n; i++) dt.items.add(new File([b], 'a' + i + '.png', { type: 'image/png' })); return dt.files.length; }, n);
  await dz.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'p.png', { type: 'image/png' })); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await dz.waitForFunction(() => document.querySelectorAll('.thumb img').length === 1);
  ok(true, 'dán ảnh (Ctrl+V) vào dòng trống đầu tiên');
  await dz.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); for (let i = 0; i < 2; i++) dt.items.add(new File([b], 'd' + i + '.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await dz.waitForFunction(() => document.querySelectorAll('.thumb img').length === 3);
  ok((await dz.locator('.orow').count()) === 3, 'kéo thả 2 ảnh: điền dòng trống rồi thêm dòng mới (tổng 3)');
  await dz.evaluate(async () => { const b = await (await fetch('icons/icon-512.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'r.png', { type: 'image/png' })); const t = document.querySelectorAll('.thumb')[1]; t.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await dz.waitForTimeout(800);
  ok((await dz.locator('.orow').count()) === 3 && (await dz.locator('.thumb img').count()) === 3, 'thả vào ô ảnh nhỏ: thay ảnh, không thêm dòng');
  ok(await dz.locator('#pastebtn').count() === 1, 'có nút Dán ảnh');
  ok(await dz.locator('#dropzone').count() === 1 && (await dz.locator('#dropzone').innerText()).includes('Kéo thả'), 'có khung kéo thả hiện rõ');
  const [fc2] = await Promise.all([dz.waitForEvent('filechooser'), dz.click('#dropzone')]); ok(!!fc2, 'bấm vào khung kéo thả mở hộp chọn ảnh');
  await dz.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/uri-list', location.origin + '/icons/icon-192.png'); dt.setData('text/html', '<img src="' + location.origin + '/icons/icon-192.png">'); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await dz.waitForFunction(() => document.querySelectorAll('.thumb img').length === 4);
  ok(true, 'kéo ảnh từ trang web khác (URL) thả vào: lấy được ảnh');
  await dz.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/uri-list', 'https://khong-ton-tai.invalid/a.png'); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await dz.waitForSelector('.notice.warn'); ok((await dz.locator('.notice.warn').innerText()).includes('Sao chép ảnh'), 'ảnh web không lấy được: báo cách làm khác');
  await noOverflow(dz, 'form tạo (có ảnh)');

  // ---- AI nhận diện trên máy (mô hình giả lập, không gọi mạng)
  const ai = await mk(); let apiCalls = 0;
  await ai.route(/anthropic\.com|huggingface\.co|jsdelivr\.net/, r => { apiCalls++; r.abort(); });
  await ai.addInitScript(() => { let n = 0; window.BINHCHON_FAKE_AI = { load: async cb => { cb(40); await new Promise(r => setTimeout(r, 300)); cb(100); }, recognize: async () => { n++; return { name: 'Áo thử ' + n, alts: ['Gợi ý ' + n] }; } }; });
  await ai.goto(base + '#new'); await ai.waitForSelector('#t');
  await ai.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); for (let i = 0; i < 2; i++) dt.items.add(new File([b], 'x' + i + '.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await ai.waitForFunction(() => document.querySelectorAll('.thumb img').length === 2);
  ok(await ai.locator('.orow input').first().inputValue() === '', 'chưa bật AI: không tự đặt tên');
  await ai.click('#aibtn'); await ai.waitForSelector('#aigo');
  const ptxt = await ai.locator('.notice:has(#aigo)').innerText();
  ok(ptxt.includes('không cần API') && ptxt.includes('150 MB') && ptxt.includes('đội bóng'), 'bảng AI nói rõ: không API, 150 MB, số đội bóng');
  ok(await ai.locator('#aikey').count() === 0, 'không còn ô nhập API key');
  await ai.click('#aigo'); await ai.waitForSelector('#aibar');
  await ai.waitForFunction(() => document.querySelector('#aiclear'));
  await ai.waitForFunction(() => document.querySelectorAll('.orow input')[0].value.startsWith('Áo thử'));
  let names = await ai.locator('.orow input').evaluateAll(els => els.map(e => e.value));
  ok(names[0] === 'Áo thử 1' && names[1] === 'Áo thử 2', 'tải xong AI thì tự đặt tên các ảnh đang có');
  ok(await ai.evaluate(() => JSON.parse(localStorage.getItem('bc_ai_ready'))) === true, 'nhớ AI đã bật');
  await ai.locator('.orow input').first().fill('Tên tôi sửa');
  await ai.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'y.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await ai.waitForFunction(() => document.querySelectorAll('.orow').length === 3);
  await ai.waitForFunction(() => document.querySelectorAll('.orow input')[2].value.startsWith('Áo thử'));
  ok((await ai.locator('.orow input').first().inputValue()) === 'Tên tôi sửa', 'tên người dùng đã sửa không bị AI ghi đè');
  ok(apiCalls === 0, 'không gọi API/mạng nào khi AI giả lập');
  // logic quyết định tên (dùng hàm thật với xác suất dựng sẵn)
  const dec = await ai.evaluate(() => {
    const { aiDecide, aiColor, aiPrompts, KB } = window.BC_TEST, T = KB.teams, O = KB.objects, nT = T.length * 3, N = nT + 2 + O.length, mk = (set) => { const P = new Array(N).fill(0.0001); for (const k in set) P[k] = set[k]; return P; };
    const ar = T.findIndex(t => t[0] === 'Arsenal'), mu = T.findIndex(t => t[0] === 'Man United'), sp = nT + 2 + O.findIndex(o => o[0] === 'Thìa');
    return [
      aiDecide(mk({ [ar * 3 + 1]: 0.8, [ar * 3]: 0.1 }), 'đỏ').name,
      aiDecide(mk({ [mu * 3]: 0.35, [mu * 3 + 1]: 0.3, [mu * 3 + 2]: 0.3 }), 'đỏ').name,
      aiDecide(mk({ [nT]: 0.9 }), 'xanh dương').name,
      aiDecide(mk({ [sp]: 0.7 }), '').name,
      aiDecide(mk({ [sp]: 0.1, [sp + 1]: 0.1, [sp + 2]: 0.1, [sp + 3]: 0.1 }), '').name,
      aiDecide(mk({ [ar * 3 + 1]: 0.5, [mu * 3]: 0.3, [T.findIndex(t => t[0] === 'Chelsea') * 3]: 0.1 }), '').alts.length,
      T.length, O.length, aiPrompts().length,
      (() => { const r = aiDecide(mk({ [ar * 3]: 0.14, [mu * 3]: 0.14, [T.findIndex(t => t[0] === 'Chelsea') * 3]: 0.14, [nT + 1]: 0.01 }), 'xám'); return [r.name, r.alts.length]; })()
    ];
  });
  ok(dec[0] === 'Arsenal – áo sân khách', 'nhận ra đội + áo sân khách: ' + dec[0]);
  ok(dec[1] === 'Áo đấu Man United', 'không chắc sân nhà/khách thì chỉ ghi tên đội: ' + dec[1]);
  ok(dec[2] === 'Áo bóng đá màu xanh dương', 'áo bóng đá lạ: ghi chung + màu: ' + dec[2]);
  ok(dec[3] === 'Thìa', 'nhận ra đồ vật: ' + dec[3]);
  ok(dec[4] === null, 'không chắc thì để trống: ' + dec[4]);
  ok(dec[5] === 2, 'gợi ý khác: ' + dec[5] + ' lựa chọn');
  ok(dec[6] >= 300 && dec[7] >= 150 && dec[8] === dec[6] * 3 + 2 + dec[7], 'kho kiến thức: ' + dec[6] + ' đội, ' + dec[7] + ' đồ vật');
  ok(typeof dec[9][0] === 'string' && dec[9][0].includes('Arsenal') && dec[9][1] >= 2, 'luôn đoán đội đứng đầu kèm gợi ý khác: ' + JSON.stringify(dec[9]));
  const mem = await ai.evaluate(() => { const a = Array.from({ length: 512 }, (_, i) => Math.sin(i)), n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)), v = a.map(x => x / n); BC_TEST.mem.save('Áo Test', v); const w = v.map((x, i) => x + (i % 2 ? 0.004 : -0.004)), m2 = Math.sqrt(w.reduce((s, x) => s + x * x, 0)), w2 = w.map(x => x / m2), other = v.map((x, i) => Math.cos(i * 7)); const o2 = Math.sqrt(other.reduce((s, x) => s + x * x, 0)); return [BC_TEST.mem.find(w2), BC_TEST.mem.find(other.map(x => x / o2))]; });
  ok(mem[0] === 'Áo Test' && mem[1] === null, 'app nhớ tên bạn đã chọn cho ảnh giống: ' + JSON.stringify(mem));
  ok(await ai.locator('datalist#bcnames option').count() > 1000 && await ai.locator('.orow input[list=bcnames]').count() >= 2, 'ô tên có danh sách gợi ý gõ nhanh (400 đội, 3 loại áo)');
  const col = await ai.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); const out = []; for (const f of ['#d62020', '#1a3fd0', '#f2d21b', '#222222', '#20a040']) { x.fillStyle = f; x.fillRect(0, 0, 40, 40); out.push(await window.BC_TEST.aiColor(c.toDataURL())); } return out; });
  ok(col.join(',') === 'đỏ,xanh dương,vàng,đen,xanh lá', 'đặt tên màu: ' + col.join(','));
  await ai.waitForSelector('#aiclear');
  await noOverflow(ai, 'form tạo (cài đặt AI)'); await ai.screenshot({ path: shots + '/07-ai.png', fullPage: true });
  ok(await ai.locator('.chip').count() >= 1, 'hiện nút gợi ý khác');
  await ai.locator('.chip').first().click(); ok((await ai.locator('.orow input').nth(0).inputValue()).startsWith('Gợi ý'), 'bấm gợi ý thì đổi tên');
  await ai.click('#aiclear'); await ai.waitForFunction(() => localStorage.getItem('bc_ai_ready') === 'false');
  ok(await ai.evaluate(() => JSON.parse(localStorage.getItem('bc_ai_ready'))) === false, 'xóa bộ nhớ AI');

  // ---- Chủ poll
  const o = await mk(); await o.goto(base); await o.waitForSelector('#newbtn');
  await noOverflow(o, 'trang chính'); await o.screenshot({ path: shots + '/01-home.png' });
  await o.click('#newbtn'); await o.waitForSelector('#t');
  await o.fill('#t', 'Chọn mẫu áo đồng phục');
  const [fc] = await Promise.all([o.waitForEvent('filechooser'), o.click('text=Thêm nhiều ảnh cùng lúc')]);
  await fc.setFiles(imgs);
  await o.waitForFunction(n => document.querySelectorAll('.thumb img').length >= n, imgs.length);
  ok((await o.locator('.orow').count()) === imgs.length, `thêm ${imgs.length} ảnh thành ${imgs.length} dòng`);
  await o.click('text=+ Thêm lựa chọn'); await o.locator('.orow input').last().fill('Không chọn mẫu nào');
  await o.fill('#mp', '3');
  await noOverflow(o, 'form tạo'); await o.screenshot({ path: shots + '/02-create.png', fullPage: true });
  await o.click('#mk'); await o.waitForSelector('#copy');
  const url = await o.inputValue('input[aria-label="Link bình chọn"]');
  ok(/#p=[a-z0-9]{10}$/.test(url), 'có link chia sẻ ' + url.replace(/^.*#/, '#'));
  await o.screenshot({ path: shots + '/03-manage.png' });

  // ---- Chủ poll chỉnh sửa
  await o.click('#editbtn'); await o.waitForSelector('#esave');
  ok(await o.locator('#editcard #et').inputValue() === 'Chọn mẫu áo đồng phục', 'mở form chỉnh sửa có sẵn tiêu đề cũ');
  ok((await o.locator('.orow').count()) === imgs.length + 1 && (await o.locator('.orow .thumb img').count()) === imgs.length, 'form sửa hiện đủ lựa chọn và ảnh');
  await o.fill('#et', 'Chọn mẫu áo đồng phục (đã sửa)');
  await o.locator('.orow input').first().fill('Mẫu A đổi tên');
  await o.click('#eadd'); await o.locator('.orow input').last().fill('Lựa chọn mới thêm');
  const [fcE] = await Promise.all([o.waitForEvent('filechooser'), o.locator('.orow .thumb').nth(1).click()]); await fcE.setFiles(imgs[0]);
  await o.waitForTimeout(500);
  await noOverflow(o, 'form chỉnh sửa'); await o.screenshot({ path: shots + '/03b-edit.png', fullPage: true });
  await o.click('#esave'); await o.waitForSelector('#editbtn');
  ok((await o.locator('.notice.ok').innerText()).includes('Đã lưu'), 'lưu chỉnh sửa thành công');
  ok((await o.locator('h1').innerText()).includes('(đã sửa)'), 'tiêu đề mới hiển thị');
  await o.click('#editbtn'); await o.waitForSelector('#esave');
  const lbls = await o.locator('.orow input').evaluateAll(els => els.map(e => e.value));
  ok(lbls[0] === 'Mẫu A đổi tên' && lbls[lbls.length - 1] === 'Lựa chọn mới thêm' && lbls.length === imgs.length + 2, 'mở lại form sửa: tên mới và lựa chọn mới đã được lưu');
  // sửa: dán, kéo thả, khung thả (form sửa đang mở)
  ok(await o.locator('#edropzone').count() === 1 && await o.locator('#epastebtn').count() === 1, 'form sửa có khung kéo thả và nút Dán ảnh');
  const nE = await o.locator('.orow').count();
  await o.evaluate(async () => { const b = await (await fetch('icons/icon-512.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'p.png', { type: 'image/png' })); document.dispatchEvent(Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: dt })); });
  await o.waitForFunction(n => document.querySelectorAll('.orow').length === n + 1, nE);
  ok(true, 'form sửa: dán ảnh (Ctrl+V) thêm lựa chọn mới');
  await o.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); for (let i = 0; i < 2; i++) dt.items.add(new File([b], 'd' + i + '.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await o.waitForFunction(n => document.querySelectorAll('.orow').length >= n + 2, nE);
  ok(true, 'form sửa: kéo thả nhiều ảnh thêm lựa chọn');
  const imgsBefore = await o.locator('.orow .thumb img').count();
  await o.evaluate(async () => { const b = await (await fetch('icons/icon-512.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'r.png', { type: 'image/png' })); document.querySelectorAll('.thumb')[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await o.waitForTimeout(700);
  ok(await o.locator('.orow .thumb img').count() === imgsBefore, 'form sửa: thả ảnh vào ô nhỏ thì thay ảnh, không thêm dòng');
  await noOverflow(o, 'form sửa (có khung thả)');
  await o.click('#ecancel'); await o.waitForSelector('#editbtn');
  await o.click('.tab >> nth=1'); ok(await o.locator('#topedit').count() === 1, 'chủ poll thấy nút Chỉnh sửa ở mọi tab');
  await o.click('#topedit'); await o.waitForSelector('#esave'); ok(true, 'nút Chỉnh sửa trên đầu trang mở form sửa'); await o.click('#ecancel'); await o.waitForSelector('#editbtn');

  // (người vote không thấy nút sửa: kiểm tra ở dưới)
  // ---- Người vote 1
  const v1 = await mk(); await v1.goto(url); await v1.waitForSelector('#nm');
  ok(await v1.locator('#topedit').count() === 0, 'người vote không thấy nút Chỉnh sửa');
  await v1.fill('#nm', 'Nguyễn Văn An'); await v1.click('#go'); await v1.waitForSelector('.opt');
  await noOverflow(v1, 'trang vote'); await v1.screenshot({ path: shots + '/04-vote.png' });
  const cards = v1.locator('.opt');
  ok((await cards.first().innerText()).includes('Mẫu A đổi tên') || (await v1.locator('.opt').allInnerTexts()).some(x => x.includes('Mẫu A đổi tên')), 'người vote thấy tên đã sửa');
  await cards.nth(0).click(); await cards.nth(1).click(); await cards.nth(2).click(); await cards.nth(3).click();
  ok((await v1.locator('.opt[aria-pressed=true]').count()) === 3, 'giới hạn tối đa 3 lựa chọn');
  ok(await v1.locator('.notice.warn').count() === 1, 'hiện cảnh báo vượt giới hạn');
  await v1.click('#submit'); await v1.waitForSelector('.rrow');
  ok((await v1.locator('.stat b').first().innerText()) === '1', 'kết quả: 1 người bình chọn');
  await noOverflow(v1, 'kết quả'); await v1.screenshot({ path: shots + '/05-results.png', fullPage: true });
  await v1.reload(); await v1.waitForSelector('.tab'); await v1.click('.tab >> nth=0');
  ok(await v1.locator('text=đã bình chọn').count() > 0, 'tải lại: thiết bị này bị khóa');

  // ---- Trùng tên (người khác, thiết bị khác)
  const v2 = await mk(); await v2.goto(url); await v2.waitForSelector('#nm');
  await v2.fill('#nm', '  nguyen van an '); await v2.click('#go'); await v2.waitForSelector('.opt');
  await v2.locator('.opt').nth(0).click(); await v2.click('#submit'); await v2.waitForSelector('.notice.err');
  ok((await v2.locator('.notice.err').innerText()).includes('đã bình chọn rồi'), 'chặn trùng tên (khác hoa thường/dấu/khoảng trắng)');
  await v2.click('text=Đổi tên'); await v2.fill('#nm', 'Trần Thị Bình'); await v2.click('#go'); await v2.waitForSelector('.opt');
  await v2.locator('.opt').nth(0).click(); await v2.locator('.opt').nth(4).click(); await v2.click('#submit'); await v2.waitForSelector('.rrow');
  ok((await v2.locator('.stat b').first().innerText()) === '2', 'người thứ hai vote được, tổng 2');

  // ---- Chủ xem quản lý + kết quả
  await o.waitForSelector('tbody tr'); ok((await o.locator('tbody tr').count()) === 2, 'quản lý thấy 2 người vote');
  await o.click('#toggle'); await o.waitForSelector('.badge.closed');
  const v3 = await mk(); await v3.goto(url); await v3.waitForSelector('.notice');
  ok((await v3.locator('.notice').first().innerText()).includes('đã đóng'), 'poll đóng thì người mới không vote được');
  await v3.screenshot({ path: shots + '/06-closed.png' });
  await o.click('text=Kết quả'); await o.waitForSelector('.rrow');
  const top = await o.locator('.rrow .name').first().innerText();
  ok(top.length > 0, 'bảng cột ngang sắp xếp, đầu bảng: ' + top);

  // ---- PWA (không ép bộ nhớ)
  const ctx2 = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'allow' });
  const pg = await ctx2.newPage(); pg.on('pageerror', e => errors.push('pwa:' + e));
  await pg.goto(base); await pg.waitForTimeout(1500);
  const cdp = await ctx2.newCDPSession(pg); const ie = await cdp.send('Page.getInstallabilityErrors');
  const ierr = ie.installabilityErrors.filter(e => e.errorId !== 'in-incognito'); // Playwright luôn là ngữ cảnh ẩn danh
  ok(ierr.length === 0, 'PWA đủ điều kiện cài (trừ cờ ẩn danh của Playwright): ' + JSON.stringify(ierr));
  const mres = await pg.evaluate(async () => { const m = await (await fetch('manifest.webmanifest')).json(); const st = await Promise.all(m.icons.map(i => fetch(i.src).then(r => r.status))); return { n: m.name, d: m.display, st }; });
  ok(mres.d === 'standalone' && mres.st.every(x => x === 200), 'manifest standalone, icon tải được ' + JSON.stringify(mres));
  const swState = await pg.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active && r.active.state; });
  ok(swState === 'activated', 'service worker activated');
  await ctx2.setOffline(true); await pg.reload(); await pg.waitForSelector('#app h1');
  ok(true, 'tải lại khi offline vẫn mở được khung app');
  const real = errors.filter(e => !/firebase|cdnjs|Failed to fetch|load/i.test(e));
  ok(real.length === 0, 'không có lỗi trang: ' + JSON.stringify(real));
  await browser.close(); console.log(fail ? `\n${fail} LỖI` : '\nQC XONG, KHÔNG LỖI'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
