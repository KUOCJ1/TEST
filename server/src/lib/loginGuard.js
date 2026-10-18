// 每個帳號的登入失敗鎖定：連續失敗 maxFailures 次，鎖定 lockMs。只放在記憶體（重啟就清掉，
// 單機低流量足夠）；用 Email 字串當 key，不論帳號是否存在都一樣處理，不會洩漏哪些 Email 有註冊。
// 取捨：知道別人 Email 的人可以故意把對方鎖住一段時間，但這比讓人無限次猜密碼安全得多；
// 鎖定很短（預設 15 分鐘）、成功登入或到期就解除。
const MAX_TRACKED = 10000;

export function createLoginGuard({ maxFailures = 5, windowMs = 15 * 60 * 1000, lockMs = 15 * 60 * 1000 } = {}) {
  const map = new Map();

  function prune(now) {
    if (map.size < MAX_TRACKED) return;
    for (const [k, v] of map) if ((v.lockedUntil ?? 0) < now && v.firstAt + windowMs < now) map.delete(k);
    // 還是太多：丟掉最舊的一批，避免被灌爆記憶體。
    if (map.size >= MAX_TRACKED) [...map.keys()].slice(0, 1000).forEach((k) => map.delete(k));
  }

  return {
    /** 回傳還要鎖多久（毫秒）；沒鎖回傳 0。 */
    lockedFor(key, now = Date.now()) {
      const e = map.get(key);
      if (!e?.lockedUntil) return 0;
      if (e.lockedUntil <= now) { map.delete(key); return 0; }
      return e.lockedUntil - now;
    },
    fail(key, now = Date.now()) {
      prune(now);
      let e = map.get(key);
      if (!e || e.firstAt + windowMs < now) { e = { count: 0, firstAt: now, lockedUntil: 0 }; map.set(key, e); }
      e.count += 1;
      if (e.count >= maxFailures) e.lockedUntil = now + lockMs;
    },
    success(key) { map.delete(key); },
  };
}
