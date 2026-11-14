import { useEffect, useState } from 'react';
import { Smartphone, X, Share, SquarePlus } from 'lucide-react';
import { detectPlatform, isStandalone, isSnoozed, snooze, hasDeferredPrompt, onDeferredPromptChange, promptInstall } from './installPrompt.js';

// 「加到主畫面」安裝引導。variant="banner"：首頁上方的提示，可以關掉（30 天內不再出現）；
// variant="card"：個人設定裡常駐的說明，關掉提示的人之後還找得到。
// 已經從主畫面開啟、或在桌機又沒有安裝事件時不顯示。
export default function InstallPrompt({ variant = 'banner' }) {
  const [platform] = useState(() => detectPlatform());
  const [standalone] = useState(() => isStandalone());
  const [canPrompt, setCanPrompt] = useState(() => hasDeferredPrompt());
  const [hidden, setHidden] = useState(() => variant === 'banner' && isSnoozed());
  const [installed, setInstalled] = useState(false);

  useEffect(() => onDeferredPromptChange(setCanPrompt), []);

  if (standalone || hidden) return null;
  // 剛安裝完（安裝事件已經用掉）要留著顯示「已安裝」，所以下面兩個條件只在還沒安裝時判斷。
  if (!installed) {
    // 桌機：只有瀏覽器真的可以安裝（有事件）時，才在個人設定顯示；首頁橫幅只給手機。
    if (platform === 'desktop' && (variant === 'banner' || !canPrompt)) return null;
    // Android 但瀏覽器沒有給安裝事件（例如已安裝、或不支援）：橫幅不顯示，個人設定給文字說明。
    if (platform === 'android' && !canPrompt && variant === 'banner') return null;
  }

  const dismiss = () => { snooze(); setHidden(true); };
  const install = async () => { if (await promptInstall()) setInstalled(true); };

  let body;
  if (installed) {
    body = <p className="text-sm text-slate-600">已安裝。之後從手機主畫面的圖示開啟就可以了。</p>;
  } else if (platform === 'in-app') {
    body = (
      <p className="text-sm text-slate-600">
        目前是在 LINE 或其他 App 內開啟，沒辦法安裝。請點右上角選單，選「用預設瀏覽器開啟」（iPhone 是 Safari、Android 是 Chrome），再回到這裡安裝。
      </p>
    );
  } else if (platform === 'ios-safari') {
    body = (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>點畫面下方的「分享」<Share className="mx-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />按鈕。</li>
        <li>往下滑，選「加入主畫面」<SquarePlus className="mx-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />。</li>
        <li>按右上角的「加入」。之後從主畫面的圖示開啟。</li>
      </ol>
    );
  } else if (platform === 'ios-other') {
    body = <p className="text-sm text-slate-600">iPhone 要用 Safari 才能安裝：請用 Safari 開啟這個網址，再點「分享」→「加入主畫面」。</p>;
  } else if (canPrompt) {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">安裝後會出現在手機主畫面，開啟時像一般 App，全螢幕、不用再輸入網址。</p>
        <button type="button" onClick={install} className="btn-primary min-h-[44px]">安裝</button>
      </div>
    );
  } else {
    body = <p className="text-sm text-slate-600">請用 Chrome 開啟這個網址，點右上角選單「⋮」→「安裝應用程式」或「加到主畫面」。</p>;
  }

  if (variant === 'card') {
    return (
      <section className="card" aria-label="安裝到手機">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-700"><Smartphone className="h-4 w-4 text-brass-600" aria-hidden="true" />安裝到手機主畫面</h3>
        <p className="mb-2 mt-1 text-sm text-slate-500">像 App 一樣從主畫面開啟，不用每次找網址。不需要到商店下載。</p>
        {body}
      </section>
    );
  }
  return (
    <div role="region" aria-label="安裝到手機" className="mb-4 rounded-2xl border border-brass-200 bg-brass-50/60 px-4 py-3 sm:hidden">
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-700"><Smartphone className="h-4 w-4 text-brass-600" aria-hidden="true" />把榕光加到手機主畫面</p>
        <button type="button" onClick={dismiss} aria-label="關閉安裝提示" className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      {body}
    </div>
  );
}
