#!/usr/bin/env python3
"""Sinh index.html, sw.js, manifest.webmanifest từ src/app.html. Dùng: python3 src/build.py "Bản 01 · 11/11/2026" """
import sys, hashlib, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
version = sys.argv[1] if len(sys.argv) > 1 else "Bản 00"
CREATOR = "Hoàng Trung Đức"
src = (root/"src/app.html").read_text(encoding="utf8")
assert "__VERSION__" in src and "__CREATOR__" in src and "/*__KNOWLEDGE__*/" in src
src = src.replace("/*__KNOWLEDGE__*/", (root/"src/knowledge.js").read_text(encoding="utf8"))
src = src.replace("__VERSION__", version).replace("__CREATOR__", CREATOR)
(root/"index.html").write_text(src, encoding="utf8")
h = hashlib.sha256((src + (root/"config.js").read_text(encoding="utf8")).encode()).hexdigest()[:10]
sw = f'''const CACHE="binhchon-{h}";
const SHELL=["./","index.html","config.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("binhchon-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener("fetch",e=>{{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;
  if(r.mode==="navigate"||u.pathname.endsWith("/config.js")||u.pathname.endsWith("/index.html")){{
    e.respondWith(fetch(r,{{cache:"no-store"}}).then(res=>{{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res}}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))));
  }} else {{
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res}})));
  }}
}});
'''
(root/"sw.js").write_text(sw, encoding="utf8")
manifest = {"name":"Bình chọn nhanh","short_name":"Bình chọn","description":"Tạo cuộc bình chọn bằng ảnh hoặc chữ, xem kết quả trực tiếp","lang":"vi","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","theme_color":"#1d4ed8","background_color":"#f5f6f8",
 "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png"},{"src":"icons/icon-512-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
(root/"manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
(root/".nojekyll").write_text("")
print("OK", version, h)
