#!/usr/bin/env python3
"""Vẽ icon PWA (3 thanh ngang như bảng kết quả) bằng PIL, supersample 4x."""
from PIL import Image, ImageDraw
import pathlib
out = pathlib.Path(__file__).resolve().parent.parent/"icons"
def draw(size, maskable=False):
    S = size*4
    im = Image.new("RGB",(S,S),(29,78,216))
    d = ImageDraw.Draw(im)
    if not maskable:
        m = Image.new("L",(S,S),0); ImageDraw.Draw(m).rounded_rectangle((0,0,S,S),radius=int(S*.22),fill=255)
        bg = Image.new("RGB",(S,S),(255,255,255)); bg.paste(im,(0,0),m); im = bg; d = ImageDraw.Draw(im)
    pad = .24 if maskable else .20
    x0 = S*pad; W = S*(1-2*pad); bh = S*.13; gap = S*.075
    top = S/2 - (3*bh+2*gap)/2
    for i,fr in enumerate((1.0,.72,.45)):
        y = top+i*(bh+gap)
        d.rounded_rectangle((x0,y,x0+W*fr,y+bh),radius=bh/2,fill=(255,255,255) if i==0 else (190,208,250))
    return im.resize((size,size),Image.LANCZOS)
draw(192).save(out/"icon-192.png"); draw(512).save(out/"icon-512.png")
draw(512,True).save(out/"icon-512-maskable.png"); draw(180).save(out/"apple-touch-icon.png"); draw(32).save(out/"favicon-32.png")
print("icons ok")
