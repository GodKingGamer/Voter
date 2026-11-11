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
  await noOverflow(dz, 'form tạo (có ảnh)');

  // ---- AI đặt tên (API giả lập)
  const ai = await mk(); let aiReq = null, aiMode = 'ok';
  await ai.route('https://api.anthropic.com/**', async route => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    aiReq = { h: route.request().headers(), b: JSON.parse(route.request().postData()) };
    if (aiMode === '401') return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { message: 'invalid x-api-key' } }) });
    const n = aiReq.b.messages[0].content.filter(c => c.type === 'image').length;
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify({ names: Array.from({ length: n }, (_, i) => 'Áo thử ' + (i + 1)) }) + '\n```' }] }) });
  });
  await ai.goto(base + '#new'); await ai.waitForSelector('#t');
  await ai.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); for (let i = 0; i < 2; i++) dt.items.add(new File([b], 'x' + i + '.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await ai.waitForFunction(() => document.querySelectorAll('.thumb img').length === 2);
  ok(await ai.locator('.orow input').first().inputValue() === '' && aiReq === null, 'chưa có key: không tự gọi AI');
  await ai.click('#aiset'); await ai.waitForSelector('#aikey');
  await ai.fill('#aikey', 'sai-dinh-dang'); await ai.click('#aisave');
  ok((await ai.locator('.notice.warn').innerText()).includes('sk-ant-'), 'từ chối key sai định dạng');
  await ai.waitForSelector('#aikey');
  await ai.fill('#aikey', 'sk-ant-test123'); await ai.click('#aisave');
  await ai.waitForFunction(() => document.querySelector('.orow input').value.startsWith('Áo thử'));
  ok(aiReq && aiReq.h['x-api-key'] === 'sk-ant-test123' && aiReq.h['anthropic-dangerous-direct-browser-access'] === 'true' && aiReq.b.model === 'claude-haiku-5-5', 'gọi đúng API: header, model');
  ok(aiReq.b.messages[0].content.filter(c => c.type === 'image').length === 2 && /^[A-Za-z0-9+\/=]+$/.test(aiReq.b.messages[0].content.find(c => c.type === 'image').source.data.slice(0, 40)), 'gửi 2 ảnh dạng base64');
  const names = await ai.locator('.orow input').evaluateAll(els => els.map(e => e.value));
  ok(names[0] === 'Áo thử 1' && names[1] === 'Áo thử 2', 'AI điền tên từng ảnh theo thứ tự (tự bóc khối ```json)');
  await ai.locator('.orow input').first().fill('Tên tôi sửa');
  await ai.evaluate(async () => { const b = await (await fetch('icons/icon-192.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'y.png', { type: 'image/png' })); document.querySelector('#optcard').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await ai.waitForFunction(() => document.querySelectorAll('.orow').length === 3);
  await ai.waitForFunction(() => document.querySelectorAll('.orow input')[2].value.startsWith('Áo thử'));
  ok((await ai.locator('.orow input').first().inputValue()) === 'Tên tôi sửa', 'tên người dùng đã sửa không bị AI ghi đè');
  aiMode = '401'; await ai.locator('.orow input').nth(2).fill('');
  await ai.click('#aibtn'); await ai.waitForSelector('.notice.err');
  ok((await ai.locator('.notice.err').innerText()).includes('API key không đúng'), 'báo lỗi rõ khi key sai (401)');
  await noOverflow(ai, 'form tạo (cài đặt AI)'); await ai.screenshot({ path: shots + '/07-ai.png', fullPage: true });

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

  // ---- Người vote 1
  const v1 = await mk(); await v1.goto(url); await v1.waitForSelector('#nm');
  await v1.fill('#nm', 'Nguyễn Văn An'); await v1.click('#go'); await v1.waitForSelector('.opt');
  await noOverflow(v1, 'trang vote'); await v1.screenshot({ path: shots + '/04-vote.png' });
  const cards = v1.locator('.opt');
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
