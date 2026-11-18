# -*- coding: utf-8 -*-
"""Fix YouTube comment export for Shorts + empty API responses."""
from pathlib import Path
import re

path = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js")
yt = path.read_text(encoding="utf-8")

old_ns = r'''function NS(n){const r=JSON.stringify(n??{}),i=r.indexOf("comment-item-section");if(i>=0){const c=[...r.slice(Math.max(0,i-2e3),i).matchAll(/"token":"([^"]{20,})"/g)];if(c.length)return c[c.length-1][1]}const l=r.match(/"reloadContinuationData":\{"continuation":"([^"]{20,})"/);return(l==null?void 0:l[1])??null}'''

new_ns = r'''function NS(n){const r=JSON.stringify(n??{});const markers=["comment-item-section","comments-section","engagement-panel-comments","shorts-panel","commentItemSectionRenderer","\"panelIdentifier\":\"engagement-panel-comments"];for(const marker of markers){const i=r.indexOf(marker);if(i<0)continue;const win=r.slice(Math.max(0,i-800),Math.min(r.length,i+5e3));const a=[...win.matchAll(/"continuationCommand"\s*:\s*\{\s*"token"\s*:\s*"([^"]{20,})"/g)];if(a.length)return a[a.length-1][1];const b=[...win.matchAll(/"reloadContinuationData"\s*:\s*\{\s*"continuation"\s*:\s*"([^"]{20,})"/g)];if(b.length)return b[b.length-1][1];const c=[...win.matchAll(/"token"\s*:\s*"([^"]{20,})"/g)];if(c.length)return c[c.length-1][1]}const l=r.match(/"reloadContinuationData":\{"continuation":"([^"]{20,})"/);return(l==null?void 0:l[1])??null}'''

if old_ns not in yt:
    raise SystemExit("NS() not found exact")
yt = yt.replace(old_ns, new_ns, 1)

old_zs = r'''function zS(n){const r=ro(n,"commentEntityPayload"),i=[];for(const l of r){const s=io(l.properties)?l.properties:{},c=io(l.author)?l.author:{},f=io(l.toolbar)?l.toolbar:{},d=io(s.content)?s.content.content:void 0,m=typeof d=="string"?d:"";if(!m)continue;const p=f.likeCountNotliked??f.likeCountLiked??"",y=f.replyCount??"";i.push({author:typeof c.displayName=="string"?c.displayName:"",text:m,likeCount:Ye(String(p))??0,replyCount:Ye(String(y))??0,publishedTime:typeof s.publishedTime=="string"?s.publishedTime:""})}return i}'''

# Need exact zS - dump may have been truncated. Get exact from file.
m = re.search(r'function zS\(n\)\{.*?return i\}', yt)
if not m:
    raise SystemExit("zS not found")
old_zs = m.group(0)
print("old zS len", len(old_zs))

new_zs = r'''function zS(n){const i=[];const r=ro(n,"commentEntityPayload");for(const l of r){const s=io(l.properties)?l.properties:{},c=io(l.author)?l.author:{},f=io(l.toolbar)?l.toolbar:{},d=io(s.content)?s.content.content:void 0,m=typeof d=="string"?d:"";if(!m)continue;const p=f.likeCountNotliked??f.likeCountLiked??"",y=f.replyCount??"";i.push({author:typeof c.displayName=="string"?c.displayName:"",text:m,likeCount:Ye(String(p))??0,replyCount:Ye(String(y))??0,publishedTime:typeof s.publishedTime=="string"?s.publishedTime:""})}if(i.length)return i;const threads=ro(n,"commentRenderer");for(const l of threads){const author=((io(l.authorText)?l.authorText:{}).simpleText)||((io(l.authorText)?(l.authorText.runs||[]):[]).map(x=>x.text).join(""))||"";const runs=((io(l.contentText)?l.contentText:{}).runs)||[];const text=runs.map(x=>x&&x.text?x.text:"").join("")||((io(l.contentText)?l.contentText:{}).simpleText)||"";if(!text)continue;const likes=Ye(String(((io(l.voteCount)?l.voteCount:{}).simpleText)||l.likeCount||""))??0;const replies=Ye(String(l.replyCount||""))??0;const published=(((io(l.publishedTimeText)?l.publishedTimeText:{}).runs)||[]).map(x=>x&&x.text?x.text:"").join("")||((io(l.publishedTimeText)?l.publishedTimeText:{}).simpleText)||"";i.push({author,text,likeCount:likes,replyCount:replies,publishedTime:published})}return i}'''

yt = yt.replace(old_zs, new_zs, 1)

old_ds_fetch = 'const b=await fetch(`https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(n.apiKey)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context:n.context,continuation:c}),signal:AbortSignal.timeout(15e3)});'
new_ds_fetch = 'const b=await fetch(`https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(n.apiKey)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({context:n.context,continuation:c}),signal:AbortSignal.timeout(15e3)});'
if old_ds_fetch not in yt:
    raise SystemExit("DS fetch not found")
yt = yt.replace(old_ds_fetch, new_ds_fetch, 1)

# Add bootstrap helper before DS and use it when Shorts token fails
# Insert after NS function (now new_ns)
bootstrap = r'''async function wingsBootstrapCommentToken(videoId,cfg){try{const html=await(await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,{credentials:"include",signal:AbortSignal.timeout(15e3)})).text();const m=html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/);if(!m)return null;const data=JSON.parse(m[1]);return NS(data)}catch{return null}}'''

if "wingsBootstrapCommentToken" not in yt:
    yt = yt.replace(new_ns, new_ns + bootstrap, 1)

# Patch export path: when rows empty or no token on shorts, bootstrap from watch page
old_export = '''const Ht=k.get(bt);if(!Ht){An(Et("댓글 정보를 아직 못 읽었어요. watch 페이지에서 다시 시도해 주세요.","Comments not loaded yet. Try on the watch page."));return}kt(ht==="csv"?"csv-run":"xls-run"),An(`${pp}${Et("댓글 추출 중… 탭을 닫지 마세요","Fetching comments… keep this tab open")}`,{sticky:!0});const Tt=Ue=>{Ue.preventDefault(),Ue.returnValue=""};window.addEventListener("beforeunload",Tt);let qt;try{qt=await DS(c,Ht,{onProgress:Ue=>An(`${pp}${Et(`댓글 추출 중… ${Ue}개 · 탭 닫지 마세요`,`Fetching comments… ${Ue} · keep this tab open`)}`,{sticky:!0})})}finally{window.removeEventListener("beforeunload",Tt),kt(null)}if(!qt||qt.rows.length===0){An(Et("추출할 댓글이 없어요","No comments to export"));return}'''

new_export = '''let Ht=k.get(bt);kt(ht==="csv"?"csv-run":"xls-run"),An(`${pp}${Et("댓글 추출 중… 탭을 닫지 마세요","Fetching comments… keep this tab open")}`,{sticky:!0});const Tt=Ue=>{Ue.preventDefault(),Ue.returnValue=""};window.addEventListener("beforeunload",Tt);let qt;try{if(!Ht){An(`${pp}${Et("댓글 토큰 준비 중…","Preparing comment token…")}`,{sticky:!0});Ht=await wingsBootstrapCommentToken(bt,c);Ht&&k.set(bt,Ht)}if(!Ht){An(Et("댓글 정보를 못 읽었어요. 댓글 패널을 한 번 연 뒤 다시 시도해 주세요.","Could not load comments. Open the comments panel once, then retry."));return}qt=await DS(c,Ht,{onProgress:Ue=>An(`${pp}${Et(`댓글 추출 중… ${Ue}개 · 탭 닫지 마세요`,`Fetching comments… ${Ue} · keep this tab open`)}`,{sticky:!0})});if((!qt||qt.rows.length===0)&&location.pathname.startsWith("/shorts/")){An(`${pp}${Et("Shorts → watch 토큰으로 재시도…","Retrying Shorts via watch token…")}`,{sticky:!0});const boot=await wingsBootstrapCommentToken(bt,c);if(boot&&boot!==Ht){k.set(bt,boot),qt=await DS(c,boot,{onProgress:Ue=>An(`${pp}${Et(`댓글 추출 중… ${Ue}개 · 탭 닫지 마세요`,`Fetching comments… ${Ue} · keep this tab open`)}`,{sticky:!0})})}}}finally{window.removeEventListener("beforeunload",Tt),kt(null)}if(!qt||qt.rows.length===0){An(Et("추출할 댓글이 없어요. Shorts면 댓글 패널을 연 뒤 다시 시도하세요.","No comments to export. On Shorts, open comments once then retry."));return}'''

if old_export not in yt:
    raise SystemExit("export block not found")
yt = yt.replace(old_export, new_export, 1)

path.write_text(yt, encoding="utf-8")

# bump version
man = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\manifest.json")
mt = man.read_text(encoding="utf-8")
mt = re.sub(r'"version": "0\.3\.65\.\d+"', '"version": "0.3.65.13"', mt)
man.write_text(mt, encoding="utf-8")
bg = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\background.js")
bt = bg.read_text(encoding="utf-8")
bt = re.sub(r'wings_version: "0\.3\.65\.\d+"', 'wings_version: "0.3.65.13"', bt)
bg.write_text(bt, encoding="utf-8")

# verify
yt2 = path.read_text(encoding="utf-8")
assert "credentials:\"include\"" in yt2[yt2.find("async function DS"):yt2.find("async function DS")+500]
assert "wingsBootstrapCommentToken" in yt2
assert "engagement-panel-comments" in yt2
assert "commentRenderer" in yt2
print("OK 0.3.65.13")
