(() => {
  const ART = { tony: "homies/tony-adult.png", betty: "homies/betty-adult.png", nori: "homies/nori-adult.png", egg: "homies/egg.png" };
  const ROOMS = { tony: "homies/room-tony.jpg", betty: "homies/room-betty.jpg", nori: "homies/room-nori.jpg" };
  const builtins = [
    { id: "tony", name: "Tony", bio: "Lazy, social, impulsive. Will want pancakes.", color: "#e8a35a" },
    { id: "betty", name: "Betty", bio: "Kind and stubborn. The garden answers to her.", color: "#d4a574" },
    { id: "nori", name: "Nori", bio: "Curious, strange, barely sleeps.", color: "#9b8cff" }
  ];
  const KEY = "homies.block.v1";
  const keeperRe = /^k[a-f0-9]{32}$/;
  let state = load();
  let tab = "care";
  let sheet = "";
  let hop = false;
  let toastText = "";

  function load() {
    const fresh = () => ({ shelf: makeShelf(), shelves: {}, active: "tony", custom: [], threads: {}, blurbs: {}, viewing: "" });
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "null") || fresh();
      if (!data.shelf || !keeperRe.test(data.shelf)) data.shelf = makeShelf();
      data.shelves[data.shelf] = data.shelves[data.shelf] || { custom: data.custom || [], threads: data.threads || {}, blurbs: data.blurbs || {} };
      return data;
    } catch { return fresh(); }
  }
  function makeShelf() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `k${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  function save() {
    state.shelves[state.shelf] = { custom: state.custom, threads: state.threads, blurbs: state.blurbs };
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function esc(v = "") { return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c])); }
  function people() { return [...builtins, ...state.custom]; }
  function person(id) { return people().find((p) => p.id === id) || builtins[0]; }
  function portrait(p) { return p.photo || ART[p.id] || ART.egg; }
  function ping(text) { toastText = text; render(); setTimeout(() => { toastText = ""; render(); }, 2200); }
  function clock() { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

  function fitPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("photo"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("photo"));
        img.onload = () => {
          const max = 240;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function render() {
    const root = document.getElementById("app");
    const p = person(state.active);
    root.innerHTML = `<section class="phone">
      <header class="top"><div><h1 class="mark">HOMIES</h1><p class="clock">${clock()} · shelf</p></div><button class="icon" id="settings" aria-label="Settings">⚙</button></header>
      <div class="roster">${people().map((item) => `<button data-id="${item.id}" class="${item.id === state.active ? "on" : ""}"><img class="face" src="${esc(portrait(item))}" alt="">${esc(item.name.split(" ")[0])}</button>`).join("")}<button id="new">＋<span class="face" style="display:grid;place-items:center;background:#fff">new</span>New</button></div>
      ${tab === "care" ? care(p) : tab === "page" ? myspace(p) : tab === "mail" ? mail(p) : home(p)}
      <nav class="nav"><button data-tab="care" class="${tab === "care" ? "on" : ""}">Care</button><button data-tab="home" class="${tab === "home" ? "on" : ""}">Home</button><button data-tab="page" class="${tab === "page" ? "on" : ""}">Page</button><button data-tab="mail" class="${tab === "mail" ? "on" : ""}">Mail</button></nav>
      ${sheet === "settings" ? settings() : ""}
      ${sheet === "make" ? maker() : ""}
      ${toastText ? `<div class="toast">${esc(toastText)}</div>` : ""}
    </section>`;
    root.querySelector("#settings").onclick = () => { sheet = "settings"; render(); };
    root.querySelector("#new").onclick = () => { sheet = "make"; render(); };
    root.querySelectorAll("[data-id]").forEach((b) => b.onclick = () => { state.active = b.dataset.id; save(); render(); });
    root.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    root.querySelectorAll("[data-care]").forEach((b) => b.onclick = () => careAct(b.dataset.care));
    const close = root.querySelector("#close"); if (close) close.onclick = () => { sheet = ""; render(); };
    const copy = root.querySelector("#copy-shelf"); if (copy) copy.onclick = () => { navigator.clipboard?.writeText(state.shelf); ping("Shelf code copied."); };
    const open = root.querySelector("#open-shelf"); if (open) open.onclick = () => openShelf(root.querySelector("#paste").value);
    const pack = root.querySelector("#copy-pack"); if (pack) pack.onclick = () => copyPack();
    const importPack = root.querySelector("#import-pack"); if (importPack) importPack.onclick = () => importShelf(root.querySelector("#pack").value);
    const file = root.querySelector("#photo"); if (file) file.onchange = async () => { const shot = await fitPhoto(file.files[0]); root.querySelector("#preview").src = shot; root.querySelector("#preview").dataset.photo = shot; };
    const make = root.querySelector("#make"); if (make) make.onclick = () => makeHomie(root);
    const send = root.querySelector("#send"); if (send) send.onclick = () => sendMail(root.querySelector("#box").value);
    const blurb = root.querySelector("#blurb"); if (blurb) blurb.onclick = () => addBlurb(root.querySelector("#blurb-box").value);
    const claim = root.querySelector("#claim"); if (claim) claim.onclick = () => claimPage(root.querySelector("#claim-box").value);
  }

  function care(p) {
    const stats = p.stats || { hunger: 70, rest: 64, fun: 72, affection: 58 };
    return `<section class="stage ${hop ? "hop" : ""} blink" style="background-image:linear-gradient(#0002,#0000),url('${ROOMS[p.base] || ROOMS.tony}')"><img class="hero" src="${esc(portrait(p))}" alt="${esc(p.name)}"><h2>${esc(p.name)}</h2><p>${esc(p.bio)}</p></section>
      <div class="meters">${Object.entries(stats).map(([k, v]) => `<div class="meter"><b>${k}</b><i><span style="width:${v}%"></span></i></div>`).join("")}</div>
      <div class="actions"><button data-care="feed">Feed</button><button data-care="play">Play</button><button data-care="rest">Rest</button><button data-care="clean">Clean</button></div>`;
  }
  function home(p) {
    return `<section class="stage" style="background-image:url('${ROOMS[p.base] || ROOMS.tony}')"><img class="hero" src="${esc(portrait(p))}" alt=""><h2>${esc(p.home || p.name + "'s room")}</h2><p>${esc(p.bio)}</p></section>`;
  }
  function myspace(p) {
    const blurbs = state.blurbs[p.id] || [];
    return `<article class="page"><p class="clock">homies.net / ${esc(p.id)} · claim ${esc(p.claim || "built-in")}</p><img class="hero" src="${esc(portrait(p))}" alt="" style="width:120px"><h2>${esc(p.name)}</h2><p>${esc(p.song || "untitled homie song")}</p><p>${esc(p.about || p.bio)}</p><p>Interests: ${esc(p.interests || "the crew")}</p><div class="row"><button id="copy-claim">Copy claim</button></div><div class="field"><input id="blurb-box" placeholder="Leave a blurb"><button id="blurb">Post</button></div>${blurbs.map((b) => `<p><b>${esc(b.from)}</b> ${esc(b.body)}</p>`).join("")}</article>`;
  }
  function mail(p) {
    const thread = state.threads[p.id] || [];
    return `<h2>Message ${esc(p.name.split(" ")[0])}</h2><div>${thread.map((m) => `<div class="bubble ${m.from}">${esc(m.body)}</div>`).join("") || "<p>No messages yet.</p>"}</div><div class="field"><input id="box" placeholder="Say what's up"><button id="send">Send</button></div><div class="field"><input id="claim-box" placeholder="Claim code"><button id="claim">Open their page</button></div>`;
  }
  function settings() {
    return `<section class="sheet"><div class="top"><h2>Shelf</h2><button id="close">✕</button></div><p>Custom Homies, portraits, pages, and messages stay on this shelf. Paste a code on another phone to open the same one.</p><p class="code">${esc(state.shelf)}</p><div class="row"><button id="copy-shelf">Copy code</button><button id="copy-pack">Copy shelf pack</button></div><label class="field">Open a shelf<input id="paste" placeholder="k…"></label><button class="primary" id="open-shelf">Open shelf</button><label class="field">Or paste a shelf pack<textarea id="pack" rows="3"></textarea></label><button id="import-pack">Import pack</button></section>`;
  }
  function maker() {
    return `<section class="sheet"><div class="top"><h2>New Homie</h2><button id="close">✕</button></div><p>Photo up. They get a character, a shelf spot, and a MySpace.</p><label class="photo"><img id="preview" alt=""><span>Tap to add a photo</span><input id="photo" type="file" accept="image/*" hidden></label><label class="field">Name<input id="name" placeholder="Who is this page for?"></label><label class="field">About them<textarea id="about" rows="3"></textarea></label><button class="primary" id="make">Move them in</button></section>`;
  }
  function careAct(kind) {
    hop = true;
    const p = person(state.active);
    p.stats = p.stats || { hunger: 70, rest: 64, fun: 72, affection: 58 };
    if (kind === "feed") p.stats.hunger = Math.min(100, p.stats.hunger + 16);
    if (kind === "play") { p.stats.fun = Math.min(100, p.stats.fun + 14); p.stats.affection = Math.min(100, p.stats.affection + 8); }
    if (kind === "rest") p.stats.rest = Math.min(100, p.stats.rest + 16);
    if (kind === "clean") p.stats.fun = Math.min(100, p.stats.fun + 4);
    if (p.custom) state.custom = state.custom.map((item) => item.id === p.id ? p : item);
    save();
    ping(`${p.name.split(" ")[0]} ${kind === "feed" ? "ate" : kind === "play" ? "played" : kind === "rest" ? "rested" : "got the room reset"}.`);
    setTimeout(() => { hop = false; render(); }, 450);
  }
  function makeHomie(root) {
    const name = root.querySelector("#name").value.trim();
    if (!name) return ping("Give them a name.");
    const photo = root.querySelector("#preview").dataset.photo || "";
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "homie";
    const homie = { id, name, bio: root.querySelector("#about").value.trim() || `${name}, written by a friend.`, about: root.querySelector("#about").value.trim(), photo, custom: true, base: "tony", claim: `${id.slice(0, 4).toUpperCase()}-804`, song: `${name.split(" ")[0]} — untitled`, interests: "the crew", stats: { hunger: 80, rest: 70, fun: 60, affection: 50 }, home: `${name.split(" ")[0]}'s room` };
    state.custom = [homie, ...state.custom.filter((item) => item.id !== id)];
    state.active = id;
    sheet = "";
    save();
    ping(`${name} moved in. Claim ${homie.claim}.`);
  }
  function openShelf(code) {
    const next = code.trim().toLowerCase();
    if (!keeperRe.test(next)) return ping("That shelf code doesn't look right.");
    state.shelf = next;
    const found = state.shelves[next] || { custom: [], threads: {}, blurbs: {} };
    state.custom = found.custom || [];
    state.threads = found.threads || {};
    state.blurbs = found.blurbs || {};
    state.active = "tony";
    save();
    sheet = "";
    ping("Shelf opened.");
  }
  function copyPack() {
    const pack = btoa(unescape(encodeURIComponent(JSON.stringify({ shelf: state.shelf, custom: state.custom, threads: state.threads, blurbs: state.blurbs }))));
    navigator.clipboard?.writeText(pack);
    ping("Shelf pack copied. Paste it on the other phone.");
  }
  function importShelf(raw) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
      if (!keeperRe.test(data.shelf)) return ping("That pack isn't a shelf.");
      state.shelves[data.shelf] = data;
      openShelf(data.shelf);
    } catch { ping("Couldn't read that pack."); }
  }
  function sendMail(body) {
    const text = body.trim();
    if (!text) return;
    const p = person(state.active);
    state.threads[p.id] = [...(state.threads[p.id] || []), { from: "me", body: text }];
    save();
    render();
    setTimeout(() => {
      state.threads[p.id].push({ from: "them", body: `${p.name.split(" ")[0]} got it. ${p.bio}` });
      save();
      if (tab === "mail") render();
    }, 600);
  }
  function addBlurb(body) {
    const text = body.trim();
    if (!text) return;
    const p = person(state.active);
    state.blurbs[p.id] = [{ from: "you", body: text }, ...(state.blurbs[p.id] || [])];
    save();
    ping("Blurb posted.");
  }
  function claimPage(code) {
    const hit = state.custom.find((item) => item.claim.toLowerCase() === code.trim().toLowerCase());
    if (!hit) return ping("No page with that claim code.");
    state.active = hit.id;
    tab = "page";
    sheet = "";
    ping(`${hit.name} claimed the page.`);
  }
  const params = new URLSearchParams(location.search);
  if (params.get("shelf")) openShelf(params.get("shelf"));
  render();
  setInterval(() => { const clockEl = document.querySelector(".clock"); if (clockEl && !sheet) clockEl.textContent = `${clock()} · shelf`; }, 30000);
})();
