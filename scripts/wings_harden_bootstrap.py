# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js")
yt = path.read_text(encoding="utf-8")

old = r'''async function wingsBootstrapCommentToken(videoId,cfg){try{const html=await(await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,{credentials:"include",signal:AbortSignal.timeout(15e3)})).text();const m=html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/);if(!m)return null;const data=JSON.parse(m[1]);return NS(data)}catch{return null}}'''

new = r'''async function wingsBootstrapCommentToken(videoId,cfg){try{const html=await(await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,{credentials:"include",signal:AbortSignal.timeout(15e3)})).text();const key="ytInitialData";const at=html.indexOf(key);if(at<0)return null;const eq=html.indexOf("=",at+key.length);const start=html.indexOf("{",eq);if(start<0)return null;let depth=0,end=-1;for(let i=start;i<html.length&&i<start+8e6;i++){const ch=html[i];if(ch==="{")depth++;else if(ch==="}"){depth--;if(depth===0){end=i+1;break}}}if(end<0)return null;const data=JSON.parse(html.slice(start,end));return NS(data)}catch{return null}}'''

if old not in yt:
    raise SystemExit("bootstrap fn not found")
path.write_text(yt.replace(old, new, 1), encoding="utf-8")
print("bootstrap hardened")
