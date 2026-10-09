/**
 * Topic Video Sidebar - content script
 * 1) 提取当前页面主题（标题 / meta / 标题层级 / 正文 的加权关键词抽取，中英文）
 * 2) 在页面右侧渲染浮层侧栏，展示 B站 / YouTube 相关优质视频
 */
(function () {
  'use strict';
  if (window.__TVS_INSTALLED__) return;
  window.__TVS_INSTALLED__ = true;

  /* ==================== 主题识别 ==================== */

  const STOP_ZH = new Set(('的 了 是 在 和 与 及 就 都 而 等 这 那 你 我 他 她 它 们 我们 你们 他们 可以 如何 什么 怎么 一个 如果 因为 所以 但是 还是 这个 那个 对于 关于 通过 进行 使用 以及 或者 不是 没有 已经 可能 需要 应该 大家 一些 很多 非常 目前 其中 之一 之后 之前 以上 以下 相关 内容 文章 视频 页面 首页 登录 注册 更多 查看 点击 分享 评论 收藏 点赞 关注 作者 时间 来源 简介 详情 推荐 阅读 全文 下载 安装 方法 问题 回答 中的 一些 这些 那些 怎样 为啥 知乎 百度 网易 腾讯 新浪 搜狐 中国 世界 今天 现在 公司 用户 系统 功能 服务 产品 数据 平台 百科 编辑 目录 导航 维基 维基百科 百科全书 全书 条目 章节 显示 隐藏 历史 搜索 贡献 讨论 引用 链接 工具 打印 导出 语言 简体 繁体 繁體 中文 设置 打开 关闭 取消 确定 返回 上一 下一 阅读更多 加载 帮助 反馈 首段 次段 上述 如下 例如 例如 也就是说 换句话说 根据 由于 因此 然而 虽然 不过 并且 而且 另外 此外 一般来说 总的来说 总体 简单 复杂 基本 主要 重要 常见 一般 通常 往往 也许 也许可以').split(/\s+/).filter(Boolean));

  const STOP_CHAR = new Set(('的了是在和与就都而及由等这那你我他她它个们很更最也又还被把从对为以于其之将所可会把该此每再者即且则不无未非自做使用通过进行对于关于以及或者但是因此所以如果虽然然而不过因为').split(''));

  const STOP_EN = new Set(('the a an and or but if then than that this these those of in on at to for from with without into over under about above by as is are was were be been being do does did doing have has had having can could should would may might must will shall not no nor so such very more most much many some any each every other another same own too also only just get got make made use used using new old one two three first last next previous via your you our their his her its my me we they them it he she i how what why when where who which whom whose all there here home page site web http https www com net org html htm php asp aspx app apps online video videos watch play list news blog post article read more less view views comment comments share like subscribe login sign signin signup account about contact help support service privacy terms').split(/\s+/).filter(Boolean));

  const SITE_TITLE_SELECTORS = [
    ['bilibili.com', 'h1.video-title, .video-title, #viewbox_report h1, h1'],
    ['youtube.com', 'h1.style-scope.ytd-watch-metadata, #title h1, yt-formatted-string.style-scope.ytd-watch-metadata, h1'],
    ['zhihu.com', 'h1.QuestionHeader-title, .Post-Title, h1'],
    ['mp.weixin.qq.com', '#activity-name, h1.rich_media_title, h1'],
    ['juejin.cn', 'h1.article-title, h1'],
    ['csdn.net', 'h1.title-article, #articleContentId, h1'],
    ['jianshu.com', 'h1._1RuRku, h1'],
    ['github.com', 'article h1, .repository-content h1, h1'],
    ['wikipedia.org', '#firstHeading, h1'],
    ['zhuanlan.zhihu.com', '.Post-Title, h1'],
    ['xiaohongshu.com', '#detail-title, .title, h1'],
    ['stackoverflow.com', '#question-header h1, h1'],
    ['medium.com', 'h1'],
    ['163.com', '.post_title, h1'],
    ['sina.com.cn', '.main-title, h1'],
    ['qq.com', '.LEFT h1, h1']
  ];

  const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function metaContent(selector) {
    const el = document.querySelector(selector);
    return el ? el.getAttribute('content') || '' : '';
  }

  function collectSources() {
    const sources = [];
    const add = (text, weight, tag) => {
      const t = cleanText(text);
      if (t) sources.push({ t, weight, tag });
    };

    const host = location.hostname;
    for (const [domain, sel] of SITE_TITLE_SELECTORS) {
      if (host.includes(domain)) {
        const el = document.querySelector(sel);
        if (el && el.textContent) { add(el.textContent, 6, 'site'); break; }
      }
    }

    add(document.title, 5.5, 'title');
    add(metaContent('meta[name="keywords"]'), 4.5, 'keywords');
    add(metaContent('meta[name="news_keywords"]'), 4, 'keywords');
    add(metaContent('meta[property="og:title"]'), 4, 'og');
    add(metaContent('meta[name="twitter:title"]'), 3, 'twitter');
    add(metaContent('meta[name="description"]'), 2, 'desc');
    add(metaContent('meta[property="og:description"]'), 2, 'ogdesc');

    const heads = document.querySelectorAll('h1');
    for (let i = 0; i < heads.length && i < 5; i++) add(heads[i].textContent, 4, 'h1');
    const h2s = document.querySelectorAll('h2');
    for (let i = 0; i < h2s.length && i < 12; i++) add(h2s[i].textContent, 2.4, 'h2');
    const h3s = document.querySelectorAll('h3');
    for (let i = 0; i < h3s.length && i < 12; i++) add(h3s[i].textContent, 1.4, 'h3');

    const main = document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.querySelector('#content') ||
      document.querySelector('.content') ||
      document.body;
    add((main.innerText || main.textContent || '').slice(0, 8000), 1, 'body');

    return sources;
  }

  // 中文：2/3/4-gram 凝聚成词（minN：单源最低出现次数，标题类短文本允许 1 次）
  function zhNgrams(text, minN) {
    minN = minN || 2;
    const segs = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    const c2 = new Map(), c3 = new Map(), c4 = new Map();
    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    for (const s of segs) {
      for (let i = 0; i + 2 <= s.length; i++) {
        bump(c2, s.substr(i, 2));
        if (i + 3 <= s.length) bump(c3, s.substr(i, 3));
        if (i + 4 <= s.length) bump(c4, s.substr(i, 4));
      }
    }
    const words = new Map();
    const covered = new Set();
    for (const [w, n] of c4) {
      if (n < minN) continue;
      const a = c3.get(w.slice(0, 3)) || 0;
      const b = c3.get(w.slice(1)) || 0;
      if (n >= 0.75 * Math.min(a, b)) {
        words.set(w, n);
        covered.add(w.slice(0, 3)); covered.add(w.slice(1));
        covered.add(w.slice(1, 3));
      }
    }
    for (const [w, n] of c3) {
      if (covered.has(w) || n < minN) continue;
      const inner = c2.get(w.slice(1)) || 0;
      if (n >= 0.7 * inner || n >= 3) {
        words.set(w, n);
        covered.add(w.slice(0, 2)); covered.add(w.slice(1));
      }
    }
    for (const [w, n] of c2) {
      if (covered.has(w) || n < minN) continue;
      words.set(w, n);
    }
    return words;
  }

  // 英文：单词 + 相邻词组
  function enWords(text) {
    const raw = String(text).toLowerCase().match(/[a-z][a-z0-9+#.\-]{1,}/g) || [];
    const c1 = new Map();
    const seq = [];
    for (const w0 of raw) {
      const w = w0.replace(/^[.\-]+|[.\-]+$/g, '');
      if (w.length < 3 || w.length > 24 || STOP_EN.has(w)) { seq.push(null); continue; }
      if (/^\d+$/.test(w)) { seq.push(null); continue; }
      c1.set(w, (c1.get(w) || 0) + 1);
      seq.push(w);
    }
    // 相邻词构成短语（如 machine learning）
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i], b = seq[i + 1];
      if (!a || !b) continue;
      const phrase = a + ' ' + b;
      c1.set(phrase, (c1.get(phrase) || 0) + 1);
    }
    const out = new Map();
    for (const [w, n] of c1) {
      if (w.includes(' ') && n < 2) continue;
      if (!w.includes(' ') && n < 1) continue;
      out.set(w, n);
    }
    return out;
  }

  function validWord(w) {
    if (!w || w.length < 2) return false;
    if (/^\d+$/.test(w)) return false;
    if (STOP_ZH.has(w)) return false;
    if (/[\u4e00-\u9fa5]/.test(w)) {
      if (STOP_CHAR.has(w[0]) || STOP_CHAR.has(w[w.length - 1])) return false;
      if (/^[0-9a-zA-Z]/.test(w)) return false;
    } else {
      if (STOP_EN.has(w.toLowerCase())) return false;
      if (w.length < 3 && !w.includes(' ')) return false;
    }
    return true;
  }

  function lcsLen(a, b) {
    let best = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        let k = 0;
        while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
        if (k > best) best = k;
      }
    }
    return best;
  }

  function extractTopic() {
    // 站点主标题（文章页的 h1 通常就是最准的主题）
    let primary = '';
    const host = location.hostname;
    for (const [domain, sel] of SITE_TITLE_SELECTORS) {
      if (host.includes(domain)) {
        const elx = document.querySelector(sel);
        if (elx && elx.textContent) {
          primary = cleanText(elx.textContent)
            .replace(/\[\s*(编辑|編輯|edit|citate|citation needed)\s*\]/gi, '')
            .split(/[|｜]/)[0].trim();
          break;
        }
      }
    }
    if (primary.includes('/')) primary = primary.split('/').filter(Boolean).pop() || '';
    if (primary.length > 20) primary = '';

    const sources = collectSources();
    const scores = new Map(); // word -> {score, count}
    const bump = (w, s) => {
      if (!validWord(w)) return;
      const cur = scores.get(w) || { score: 0, count: 0 };
      cur.score += s;
      cur.count += 1;
      scores.set(w, cur);
    };

    let titleText = '';
    let h1Text = '';
    for (const s of sources) {
      if (s.tag === 'title' || s.tag === 'site' || s.tag === 'og') titleText += ' ' + s.t;
      if (s.tag === 'h1') h1Text += ' ' + s.t;

      if (s.tag === 'keywords') {
        // meta keywords 直接作为高质量候选
        s.t.split(/[,，;；|、\s]+/).forEach((w) => {
          w = w.trim();
          if (w.length >= 2 && w.length <= 20) bump(w, s.weight * 2.2);
        });
      }
      const zh = zhNgrams(s.t, s.weight >= 3 ? 1 : 2);
      zh.forEach((n, w) => bump(w, s.weight * (1 + Math.log(n))));
      const en = enWords(s.t);
      en.forEach((n, w) => bump(w, s.weight * (1 + Math.log(n)) * 1.1));
    }

    let list = [...scores.entries()].map(([word, v]) => ({ word, score: v.score, count: v.count }));
    // 位置加成
    list.forEach((it) => {
      if (titleText.includes(it.word)) it.score *= 1.9;
      else if (h1Text.includes(it.word)) it.score *= 1.4;
      if (it.word.length >= 3) it.score *= 1.3;
      if (it.word.length >= 4) it.score *= 1.4;
    });

    list.sort((a, b) => b.score - a.score);

    // 去掉被更长高分词汇吸收的短词
    const kept = [];
    for (const a of list) {
      let dominated = false;
      for (const b of kept) {
        if (b.word.length > a.word.length && b.word.includes(a.word) && b.score >= a.score * 0.75) { dominated = true; break; }
        if (a.word.length > b.word.length && a.word.includes(b.word) && a.score > b.score * 0.6) b._drop = true;
      }
      if (!dominated) kept.push(a);
    }
    list = kept.filter((x) => !x._drop);

    // 高度重叠的病态词去重（如「工智能研」vs「人工智能」）
    const dedup = [];
    for (const it of list) {
      let drop = false;
      for (const kd of dedup) {
        const ov = lcsLen(it.word, kd.word);
        if (ov >= Math.min(it.word.length, kd.word.length) - 1 && ov >= 2) { drop = true; break; }
      }
      if (!drop) dedup.push(it);
    }

    const keywords = dedup.slice(0, 6).map((x) => x.word);
    if (!keywords.length) {
      const fallback = cleanText(document.title).split(/[\s|\-—–_,，。]+/).filter((x) => x.length >= 2).slice(0, 3);
      keywords.push(...fallback);
    }

    // 站点主标题短小精准时直接作为搜索词
    let query;
    if (primary && primary.length >= 2 && !STOP_ZH.has(primary)) {
      query = primary;
      if (!keywords.includes(primary)) keywords.unshift(primary);
    } else {
      query = keywords.slice(0, 3).join(' ').slice(0, 80);
    }
    return { keywords, query, title: cleanText(document.title) };
  }

  /* ==================== 侧栏 UI ==================== */

  const state = {
    settings: { autoOpen: true, platform: 'both', order: 'views', limit: 12 },
    topic: { keywords: [], query: '' },
    loading: false,
    error: null,
    results: [],
    subHits: [],
    notifyEnabled: true,
    collapsed: false,
    hidden: false,
    width: 360,
    editing: false,
    lastUrl: location.href
  };

  let host, shadow, root, panel, listEl, launcher, toastBox, toastTimer;

  function buildDom() {
    host = document.createElement('div');
    host.id = 'topic-video-sidebar-host';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = window.TVS_CSS || '';
    shadow.appendChild(style);

    root = document.createElement('div');
    root.className = 'tv-host';
    shadow.appendChild(root);

    panel = document.createElement('div');
    panel.className = 'tv-panel';
    root.appendChild(panel);

    const resizer = document.createElement('div');
    resizer.className = 'tv-resizer';
    resizer.title = '拖动调整宽度';
    panel.appendChild(resizer);

    launcher = document.createElement('div');
    launcher.className = 'tv-launcher';
    launcher.textContent = '主题视频';
    launcher.title = '展开主题视频侧栏（Alt+V）';
    launcher.style.display = 'none';
    root.appendChild(launcher);

    document.documentElement.appendChild(host);
    bindEvents(resizer);
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    if (!panel) return;
    panel.innerHTML = '';
    const resizer = el('div', 'tv-resizer');
    resizer.title = '拖动调整宽度';
    panel.appendChild(resizer);
    panel.style.width = state.width + 'px';

    /* header */
    const header = el('div', 'tv-header');
    const logo = el('div', 'tv-logo', '▶');
    header.appendChild(logo);
    header.appendChild(el('div', 'tv-name', '主题视频'));
    const refreshBtn = el('button', 'tv-iconbtn', '↻');
    refreshBtn.title = '重新搜索';
    refreshBtn.onclick = () => refresh(true);
    const collapseBtn = el('button', 'tv-iconbtn', '⟩');
    collapseBtn.title = '收起侧栏';
    collapseBtn.onclick = () => { setCollapsed(true); };
    const closeBtn = el('button', 'tv-iconbtn', '✕');
    closeBtn.title = '关闭（点击扩展图标可再次打开）';
    closeBtn.onclick = () => setHidden(true);
    header.appendChild(refreshBtn);
    header.appendChild(collapseBtn);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    /* tabs */
    const tabs = el('div', 'tv-tabs');
    [['both', '全部'], ['bilibili', 'B站'], ['youtube', 'YouTube']].forEach(([key, label]) => {
      const t = el('button', 'tv-tab ' + (key === 'bilibili' ? 'bili' : key === 'youtube' ? 'yt' : ''), label);
      t.dataset.active = String(state.settings.platform === key);
      t.onclick = () => {
        state.settings.platform = key;
        chrome.storage.sync.set({ platform: key });
        refresh(false);
      };
      tabs.appendChild(t);
    });
    panel.appendChild(tabs);

    /* topic */
    const topicBox = el('div', 'tv-topic');
    const label = el('div', 'tv-topic-label');
    label.appendChild(el('span', null, '识别到的主题'));
    const editBtn = el('button', null, state.editing ? '收起' : '改词');
    editBtn.onclick = () => { state.editing = !state.editing; render(); };
    label.appendChild(editBtn);
    topicBox.appendChild(label);

    const chips = el('div', 'tv-chips');
    const activeWords = new Set(state.topic.query.split(/\s+/).filter(Boolean));
    state.topic.keywords.forEach((w) => {
      const on = activeWords.has(w) || state.topic.query.includes(w);
      const chip = el('span', 'tv-chip', w);
      chip.dataset.on = String(on);
      chip.title = on ? '点击移除该关键词' : '点击加入搜索';
      chip.onclick = () => {
        const set = new Set(state.topic.query.split(/\s+/).filter(Boolean));
        if (set.has(w)) set.delete(w); else set.add(w);
        state.topic.query = [...set].join(' ');
        render();
        refresh(true);
      };
      chips.appendChild(chip);
    });
    topicBox.appendChild(chips);

    if (state.editing) {
      const qbox = el('div', 'tv-querybox');
      const input = document.createElement('input');
      input.value = state.topic.query;
      input.placeholder = '输入搜索关键词，回车确认';
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { state.topic.query = input.value.trim(); render(); refresh(true); }
      };
      const btn = el('button', null, '搜索');
      btn.onclick = () => { state.topic.query = input.value.trim(); render(); refresh(true); };
      qbox.appendChild(input);
      qbox.appendChild(btn);
      topicBox.appendChild(qbox);
    }
    panel.appendChild(topicBox);

    /* 订阅命中 */
    if (state.subHits.length) {
      const totalFresh = state.subHits.reduce((n, h) => n + (h.fresh?.length || 0), 0);
      const sec = el('div', 'tv-subs');
      const hd = el('div', 'tv-subs-hd');
      hd.appendChild(el('span', null, '订阅博主命中'));
      const badge = el('span', 'tv-subs-badge', String(state.subHits.length));
      hd.appendChild(badge);
      if (totalFresh) hd.appendChild(el('span', 'tv-subs-new', `${totalFresh} 条新`));
      sec.appendChild(hd);
      state.subHits.slice(0, 4).forEach((h) => {
        (h.videos || []).slice(0, 2).forEach((v) => {
          const row = document.createElement('a');
          row.className = 'tv-subs-item';
          row.href = v.url;
          row.target = '_blank';
          row.rel = 'noopener noreferrer';
          const who = el('span', 'tv-subs-who ' + v.platform, h.sub?.name || v.subName || '');
          const txt = el('span', 'tv-subs-title', v.title);
          row.appendChild(who);
          row.appendChild(txt);
          sec.appendChild(row);
        });
      });
      panel.appendChild(sec);
    }

    /* list */
    listEl = el('div', 'tv-list');
    panel.appendChild(listEl);
    renderList();

    /* footer */
    const footer = el('div', 'tv-footer');
    footer.appendChild(el('span', null, '排序'));
    const sel = document.createElement('select');
    [['views', '播放量'], ['relevance', '相关度'], ['date', '最新']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (state.settings.order === v) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      state.settings.order = sel.value;
      chrome.storage.sync.set({ order: sel.value });
      refresh(true);
    };
    footer.appendChild(sel);
    const count = el('span', null, state.loading ? '搜索中…' : (mergedItems().length + ' 个视频'));
    count.style.marginLeft = 'auto';
    footer.appendChild(count);
    panel.appendChild(footer);

    panel.dataset.collapsed = String(state.collapsed);
    launcher.style.display = (state.collapsed || state.hidden) && !state.hidden ? 'block' : (state.hidden ? 'block' : 'none');
    panel.style.display = state.hidden ? 'none' : 'flex';
    launcher.style.display = state.hidden ? 'block' : (state.collapsed ? 'block' : 'none');
    bindResizer(resizer);
  }

  function mergedItems() {
    let items = [];
    for (const r of state.results) items = items.concat(r.items || []);
    if (state.settings.order === 'views') items = items.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (state.settings.order === 'date') items = items.slice().sort((a, b) => (b.published || 0) - (a.published || 0));
    // 去重
    const seen = new Set();
    return items.filter((it) => {
      const k = it.platform + it.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.loading && !state.results.length) {
      for (let i = 0; i < 4; i++) {
        const s = el('div', 'tv-skel');
        const s1 = el('div', 's1 tv-shimmer');
        const s2 = el('div', 's2');
        s2.appendChild(el('div', 'tv-shimmer'));
        s2.appendChild(el('div', 'tv-shimmer'));
        s2.lastChild.style.width = '60%';
        s.appendChild(s1); s.appendChild(s2);
        listEl.appendChild(s);
      }
      return;
    }

    const errors = state.results.filter((r) => r.error);
    errors.forEach((r) => {
      const box = el('div', 'tv-error');
      const name = r.platform === 'bilibili' ? '哔哩哔哩' : 'YouTube';
      box.textContent = `${name}：${r.error}`;
      listEl.appendChild(box);
    });

    const items = mergedItems();
    if (!items.length && !errors.length) {
      const empty = el('div', 'tv-empty');
      empty.appendChild(el('div', null, '暂无结果，试试修改关键词'));
      const a = document.createElement('a');
      a.href = 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(state.topic.query);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '去 B站搜索';
      empty.appendChild(a);
      listEl.appendChild(empty);
      return;
    }

    items.forEach((it) => {
      const card = document.createElement('a');
      card.className = 'tv-card';
      card.href = it.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.title = it.title;

      const thumb = el('div', 'tv-thumb');
      const img = document.createElement('img');
      img.referrerPolicy = 'no-referrer';
      img.loading = 'lazy';
      img.src = it.thumb || '';
      img.onerror = () => { img.style.display = 'none'; };
      thumb.appendChild(img);
      if (it.duration) thumb.appendChild(el('span', 'tv-dur', it.duration));
      const badge = el('span', 'tv-badge ' + it.platform, it.platform === 'bilibili' ? 'B站' : 'YT');
      thumb.appendChild(badge);
      card.appendChild(thumb);

      const info = el('div', 'tv-info');
      info.appendChild(el('div', 'tv-title', it.title));
      const sub = el('div', 'tv-sub');
      const author = el('b', null, it.author || (it.platform === 'bilibili' ? 'B站' : 'YouTube'));
      sub.appendChild(author);
      if (it.viewsText) {
        sub.appendChild(document.createTextNode(' · '));
        sub.appendChild(el('span', 'tv-views', it.viewsText + '次播放'));
      }
      info.appendChild(sub);
      card.appendChild(info);

      listEl.appendChild(card);
    });
  }

  function bindResizer(resizer) {
    let dragging = false;
    resizer.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
      const move = (ev) => {
        if (!dragging) return;
        const w = Math.min(Math.max(window.innerWidth - ev.clientX, 280), 620);
        state.width = w;
        panel.style.width = w + 'px';
      };
      const up = () => {
        dragging = false;
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        chrome.storage.local.set({ tvsWidth: state.width });
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  function bindEvents() { /* 预留：resizer 在 render 中重新绑定 */ }

  async function refresh(force) {
    if (!state.topic.query) state.topic = extractTopic();
    if (!state.topic.query) {
      state.error = '未能识别主题';
      render();
      return;
    }
    state.loading = true;
    state.results = force ? [] : state.results;
    state.loading = true;
    render();

    const platforms = state.settings.platform === 'both' ? ['bilibili', 'youtube'] : [state.settings.platform];
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'tvs.search',
        query: state.topic.query,
        platforms,
        order: state.settings.order,
        limit: state.settings.limit || 12
      });
      if (!resp) throw new Error('没有收到后台响应');
      if (!resp.ok) throw new Error(resp.error || '搜索失败');
      state.results = resp.results || [];
      state.error = null;
    } catch (e) {
      state.results = [];
      state.error = e?.message || String(e);
      const box = listEl; // 错误在 renderList 中展示
      if (box) {
        box.innerHTML = '';
        const err = el('div', 'tv-error', state.error.includes('message channel') || state.error.includes('Extension context')
          ? '扩展已更新，请刷新页面后重试' : state.error);
        box.appendChild(err);
      }
      state.loading = false;
      return;
    }
    state.loading = false;
    render();
    checkSubscriptions();
  }

  /* ==================== 订阅提醒 ==================== */

  async function checkSubscriptions() {
    if (!state.topic.query) return;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'tvs.checkSubs',
        query: state.topic.query,
        keywords: state.topic.keywords
      });
      if (!resp || !resp.ok) return;
      state.subHits = resp.hits || [];
      const fresh = [];
      state.subHits.forEach((h) => (h.fresh || []).forEach((v) => fresh.push({ sub: h.sub, video: v })));
      render();
      // 侧栏没打开时才弹右上角提醒
      if (fresh.length && state.notifyEnabled && (state.hidden || state.collapsed)) {
        showToast(fresh.slice(0, 3), fresh.length);
      }
    } catch (_) { /* 忽略订阅检查失败 */ }
  }

  function showToast(list, total) {
    if (toastTimer) clearTimeout(toastTimer);
    if (!toastBox) {
      toastBox = el('div', 'tv-toast');
      root.appendChild(toastBox);
    }
    toastBox.innerHTML = '';
    toastBox.style.display = 'block';

    const hd = el('div', 'tv-toast-hd');
    hd.appendChild(el('span', null, '订阅博主有新视频'));
    hd.appendChild(el('span', 'tv-toast-cnt', String(total)));
    const x = el('button', 'tv-toast-x', '✕');
    x.onclick = hideToast;
    hd.appendChild(x);
    toastBox.appendChild(hd);

    list.forEach(({ sub, video }) => {
      const a = document.createElement('a');
      a.className = 'tv-toast-item';
      a.href = video.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.onclick = hideToast;
      const img = document.createElement('img');
      img.referrerPolicy = 'no-referrer';
      img.src = video.thumb || '';
      img.onerror = () => { img.style.visibility = 'hidden'; };
      a.appendChild(img);
      const info = el('div', 'tv-toast-info');
      info.appendChild(el('div', 'tv-toast-title', video.title));
      info.appendChild(el('div', 'tv-toast-sub',
        (sub?.name || video.subName || '') + (video.viewsText ? ' · ' + video.viewsText + '次播放' : '')));
      a.appendChild(info);
      toastBox.appendChild(a);
    });

    const more = el('button', 'tv-toast-more', '在侧栏查看全部命中');
    more.onclick = () => { hideToast(); setHidden(false); setCollapsed(false); };
    toastBox.appendChild(more);

    toastTimer = setTimeout(hideToast, 25000);
  }

  function hideToast() {
    if (toastBox) toastBox.style.display = 'none';
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  function setCollapsed(v) {
    state.collapsed = v;
    panel.dataset.collapsed = String(v);
    launcher.style.display = v ? 'block' : 'none';
  }

  function setHidden(v) {
    state.hidden = v;
    panel.style.display = v ? 'none' : 'flex';
    launcher.style.display = v ? 'block' : 'none';
    chrome.storage.local.set({ tvsHidden: v });
  }

  /* ==================== 初始化 ==================== */

  async function init() {
    buildDom();
    const cfg = await chrome.storage.sync.get({ autoOpen: true, platform: 'both', order: 'views', limit: 12, notifyEnabled: true });
    state.settings = { ...state.settings, ...cfg };
    state.notifyEnabled = !!cfg.notifyEnabled;
    const local = await chrome.storage.local.get({ tvsHidden: false, tvsWidth: 360 });
    state.hidden = !!local.tvsHidden;
    state.width = local.tvsWidth || 360;

    state.topic = extractTopic();
    render();

    launcher.onclick = () => { setHidden(false); setCollapsed(false); };

    if (!state.hidden) {
      if (state.settings.autoOpen) {
        refresh(true);           // 展开侧栏（内部会顺带检查订阅）
      } else {
        state.collapsed = true;  // 侧栏收起，只做订阅提醒
        render();
        checkSubscriptions();
      }
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.notifyEnabled) state.notifyEnabled = !!changes.notifyEnabled.newValue;
      const next = {};
      ['autoOpen', 'platform', 'order', 'limit'].forEach((k) => { if (changes[k]) next[k] = changes[k].newValue; });
      if (Object.keys(next).length) {
        state.settings = { ...state.settings, ...next };
        render();
        if (!state.hidden) refresh(true);
      }
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'tvs.toggle') {
        if (state.hidden || state.collapsed) { setHidden(false); setCollapsed(false); }
        else setHidden(true);
      } else if (msg.type === 'tvs.show') {
        setHidden(false); setCollapsed(false);
        if (!state.results.length) refresh(true);
      } else if (msg.type === 'tvs.refresh') {
        state.topic = extractTopic();
        setHidden(false); setCollapsed(false);
        refresh(true);
      } else if (msg.type === 'tvs.refreshSubs') {
        checkSubscriptions();
      }
    });

    // SPA 页面 URL 变化后重新识别主题
    setInterval(() => {
      if (location.href !== state.lastUrl) {
        state.lastUrl = location.href;
        state.topic = extractTopic();
        if (!state.hidden && state.settings.autoOpen) refresh(true);
      }
    }, 1500);

    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        if (state.hidden || state.collapsed) { setHidden(false); setCollapsed(false); }
        else setHidden(true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
