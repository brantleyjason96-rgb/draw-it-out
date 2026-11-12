// Class timer, client side. Used by the teaching screen, the student page and the projector.
// The server sends TIME REMAINING in milliseconds (never a clock time). Each page counts down from the moment the message
// arrived using performance.now(), which does not depend on the device's clock, so a Chromebook with the wrong time is still right.
const TK = (() => {
  let st = null, iv = 0; const tickers = [], dones = [];
  const left = () => (!st ? 0 : st.paused ? st.left : Math.max(0, st.left - (performance.now() - st.at)));
  const secs = () => Math.ceil(left() / 1000);
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const fire = () => tickers.forEach(f => f(st ? { secs: secs(), paused: st.paused, running: true } : { running: false }));
  function sched() {
    clearInterval(iv); iv = 0;
    if (st && !st.paused) iv = setInterval(() => { fire(); }, 250); // 4 checks a second keeps the digits on the second without drifting
    fire();
  }
  return {
    left, secs, fmt,
    active: () => !!st,
    // feed every server message through this: { t:'timer', left, paused } | { t:'timer', off } | { t:'timer', done }
    handle(m) {
      if (m.done) { st = null; sched(); dones.forEach(f => f()); return; }
      if (m.off || m.left == null) { st = null; return sched(); }
      st = { at: performance.now(), left: m.left, paused: !!m.paused, freeze: !!m.freeze }; sched();
    },
    set(m) { st = m && m.left != null ? { at: performance.now(), left: m.left, paused: !!m.paused, freeze: !!m.freeze } : null; sched(); }, // from state / joined
    onTick(f) { tickers.push(f); }, onDone(f) { dones.push(f); },
    parse(txt) { // "4", "1.5" (minutes) or "1:30" -> seconds, or null
      const t = String(txt || '').trim(); let s;
      if (/^\d{1,3}:[0-5]?\d$/.test(t)) { const [m, x] = t.split(':'); s = (+m) * 60 + (+x); }
      else if (/^\d+([.,]\d+)?$/.test(t)) s = Math.round(parseFloat(t.replace(',', '.')) * 60);
      else return null;
      return s;
    },
  };
})();
