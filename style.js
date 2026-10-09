/* 侧边栏样式：作为字符串注入 Shadow DOM，避免与页面样式互相污染 */
window.TVS_CSS = `
:host {
  all: initial;
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  z-index: 2147483000;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  color: #1f2328;
  line-height: 1.5;
}
.tv-host {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
}
.tv-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100vh;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid #e3e6ea;
  box-shadow: -8px 0 28px rgba(20, 25, 40, 0.14);
  transform: translateX(0);
  transition: transform .22s cubic-bezier(.2,.8,.2,1);
  pointer-events: auto;
}
.tv-panel[data-collapsed="true"] {
  transform: translateX(100%);
}
.tv-resizer {
  position: absolute;
  left: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
}
.tv-resizer:hover { background: rgba(91,108,255,.35); }

.tv-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 8px 12px;
  border-bottom: 1px solid #eef0f3;
  background: linear-gradient(180deg, #fbfcff 0%, #ffffff 100%);
}
.tv-logo {
  width: 22px; height: 22px; border-radius: 7px;
  background: linear-gradient(135deg, #6b7cff, #8f5bff);
  color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center;
  flex: none;
}
.tv-name { font-weight: 700; font-size: 13px; margin-right: auto; letter-spacing: .2px; }
.tv-iconbtn {
  border: none; background: transparent; cursor: pointer;
  width: 26px; height: 26px; border-radius: 7px; color: #5b6472;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.tv-iconbtn:hover { background: #f1f3f7; color: #1f2328; }

.tv-tabs { display: flex; gap: 6px; padding: 8px 12px 0; }
.tv-tab {
  flex: 1; text-align: center; padding: 5px 0; border-radius: 8px; cursor: pointer;
  background: #f3f5f9; color: #5b6472; font-size: 12px; border: none;
}
.tv-tab[data-active="true"] { background: #eef0ff; color: #4a56d8; font-weight: 700; }
.tv-tab.bili[data-active="true"] { background: #ffeef4; color: #d94f7c; }
.tv-tab.yt[data-active="true"] { background: #ffeeec; color: #d93a30; }

.tv-topic { padding: 9px 12px 10px; border-bottom: 1px solid #f1f3f6; }
.tv-topic-label { font-size: 11px; color: #8a929f; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.tv-topic-label button {
  margin-left: auto; border: 1px solid #dfe3ea; background: #fff; color: #5b6472;
  border-radius: 6px; font-size: 11px; padding: 1px 7px; cursor: pointer;
}
.tv-topic-label button:hover { color: #4a56d8; border-color: #b9c0ff; }
.tv-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.tv-chip {
  padding: 3px 9px; border-radius: 999px; font-size: 12px; cursor: pointer;
  background: #f3f5f9; color: #3d4654; border: 1px solid transparent; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tv-chip[data-on="true"] { background: #eef0ff; border-color: #c3caff; color: #4a56d8; }
.tv-chip[data-on="false"] { opacity: .45; text-decoration: line-through; }
.tv-querybox { display: flex; gap: 6px; margin-top: 7px; }
.tv-querybox input {
  flex: 1; min-width: 0; border: 1px solid #dfe3ea; border-radius: 8px; padding: 5px 8px;
  font-size: 12px; outline: none; color: #1f2328; background: #fff;
}
.tv-querybox input:focus { border-color: #9aa4ff; }
.tv-querybox button {
  border: none; background: #5b6cff; color: #fff; border-radius: 8px; padding: 0 12px;
  font-size: 12px; cursor: pointer;
}
.tv-querybox button:hover { background: #4859f5; }

.tv-list { flex: 1; overflow-y: auto; padding: 8px 12px 16px; }
.tv-list::-webkit-scrollbar { width: 7px; }
.tv-list::-webkit-scrollbar-thumb { background: #d8dce3; border-radius: 4px; }
.tv-list::-webkit-scrollbar-thumb:hover { background: #c2c7d0; }

.tv-card {
  display: flex; gap: 9px; padding: 7px; border-radius: 10px; margin-bottom: 6px;
  text-decoration: none; color: inherit; cursor: pointer; background: #fff;
}
.tv-card:hover { background: #f6f8fc; }
.tv-thumb { position: relative; flex: none; width: 124px; height: 70px; border-radius: 8px; overflow: hidden; background: #eceff4; }
.tv-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tv-dur {
  position: absolute; right: 4px; bottom: 4px; background: rgba(0,0,0,.75); color: #fff;
  font-size: 10px; padding: 0 4px; border-radius: 4px; line-height: 15px;
}
.tv-badge {
  position: absolute; left: 4px; top: 4px; font-size: 10px; color: #fff; padding: 0 5px;
  border-radius: 4px; line-height: 15px;
}
.tv-badge.bilibili { background: #fb7299; }
.tv-badge.youtube { background: #ff4e45; }
.tv-info { min-width: 0; flex: 1; }
.tv-title {
  font-size: 12.5px; font-weight: 600; color: #1f2328; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tv-sub { margin-top: 4px; font-size: 11px; color: #8a929f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tv-sub b { color: #6b7383; font-weight: 600; }
.tv-views { color: #e0644f; font-weight: 600; }

.tv-empty { padding: 22px 8px; text-align: center; color: #8a929f; font-size: 12px; }
.tv-empty a { color: #5b6cff; text-decoration: none; }
.tv-error { padding: 10px; margin: 6px 0; background: #fff5f4; color: #b4453a; border-radius: 8px; font-size: 11.5px; }

.tv-skel { display: flex; gap: 9px; padding: 7px; margin-bottom: 6px; }
.tv-skel .s1 { width: 124px; height: 70px; border-radius: 8px; flex: none; }
.tv-skel .s2 { flex: 1; }
.tv-skel .s2 div { height: 10px; border-radius: 5px; margin-bottom: 8px; }
.tv-shimmer {
  background: linear-gradient(90deg, #eef1f5 25%, #f7f9fc 37%, #eef1f5 63%);
  background-size: 400% 100%; animation: tvshimmer 1.3s ease infinite;
}
@keyframes tvshimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.tv-footer {
  padding: 6px 12px; border-top: 1px solid #f1f3f6; font-size: 11px; color: #a0a7b4;
  display: flex; align-items: center; gap: 8px;
}
.tv-footer select {
  border: 1px solid #e3e6ea; border-radius: 6px; font-size: 11px; padding: 1px 4px; color: #5b6472; background: #fff;
}

.tv-launcher {
  position: fixed; right: 0; top: 120px;
  width: 30px; padding: 10px 6px; border-radius: 10px 0 0 10px;
  background: linear-gradient(135deg, #6b7cff, #8f5bff); color: #fff; cursor: pointer;
  box-shadow: -3px 3px 14px rgba(20,25,40,.22); font-size: 12px; text-align: center;
  writing-mode: vertical-rl; letter-spacing: 2px;
  pointer-events: auto;
}
.tv-launcher:hover { filter: brightness(1.08); }

/* 右上角订阅提醒 */
.tv-toast {
  position: fixed;
  top: 14px;
  right: 14px;
  width: 322px;
  background: #fff;
  border: 1px solid #e6e9ef;
  border-radius: 14px;
  box-shadow: 0 12px 34px rgba(20, 25, 40, .18);
  overflow: hidden;
  pointer-events: auto;
  display: none;
  animation: tvtoastin .26s cubic-bezier(.2,.8,.2,1);
}
@keyframes tvtoastin {
  from { transform: translateY(-10px) scale(.98); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.tv-toast-hd {
  display: flex; align-items: center; gap: 6px; padding: 9px 10px 9px 12px;
  font-weight: 700; font-size: 12.5px; color: #fff;
  background: linear-gradient(135deg, #6b7cff, #8f5bff);
}
.tv-toast-cnt { background: rgba(255,255,255,.3); border-radius: 999px; padding: 0 7px; font-size: 11px; }
.tv-toast-x {
  margin-left: auto; background: transparent; border: none; color: #fff;
  cursor: pointer; font-size: 13px; padding: 0 2px;
}
.tv-toast-item {
  display: flex; gap: 8px; padding: 8px 10px; text-decoration: none; color: inherit;
  border-bottom: 1px solid #f4f6f9;
}
.tv-toast-item:hover { background: #f7f9fd; }
.tv-toast-item img {
  width: 84px; height: 48px; border-radius: 7px; object-fit: cover; flex: none; background: #eceff4;
}
.tv-toast-info { min-width: 0; }
.tv-toast-title {
  font-size: 12px; font-weight: 600; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tv-toast-sub { font-size: 11px; color: #8a929f; margin-top: 3px; }
.tv-toast-more {
  width: 100%; border: none; background: #f7f8fc; color: #4a56d8;
  font-size: 12px; padding: 9px; cursor: pointer;
}
.tv-toast-more:hover { background: #eef0ff; }

/* 侧栏内的订阅命中区 */
.tv-subs {
  margin: 8px 12px 0; padding: 8px 10px;
  background: #fffaf2; border: 1px solid #ffe6c7; border-radius: 10px;
}
.tv-subs-hd {
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
  font-size: 11.5px; font-weight: 700; color: #8a5a1b;
}
.tv-subs-badge { background: #f5a623; color: #fff; border-radius: 999px; padding: 0 6px; font-size: 10.5px; }
.tv-subs-new { color: #c2564b; font-size: 11px; }
.tv-subs-item {
  display: flex; gap: 6px; align-items: baseline; padding: 3px 0; text-decoration: none; color: inherit;
}
.tv-subs-who {
  flex: none; font-size: 10.5px; padding: 1px 6px; border-radius: 5px;
  background: #f3f5f9; color: #5b6472;
}
.tv-subs-who.bilibili { background: #ffeef4; color: #d94f7c; }
.tv-subs-who.youtube { background: #ffeeec; color: #d93a30; }
.tv-subs-title { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tv-subs-item:hover .tv-subs-title { color: #4a56d8; }
`;
