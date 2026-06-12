import { useState, useRef } from 'react';
import { X, Calendar, Download, Upload, LogOut } from 'lucide-react';

export default function GoogleSettingsModal({
  isOpen, onClose,
  isConnected, isLoading, error, scriptsReady, clientId,
  connect, disconnect,
  events, addEvent,
  onExportIcs, onImportIcs,
}) {
  const [inputClientId, setInputClientId] = useState(clientId || '');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  if (!isOpen) return null;

  function saveClientId() {
    localStorage.setItem('cal_google_client_id', inputClientId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.location.reload(); // reload to reinitialize GAPI with new client ID
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      onImportIcs(evt.target.result);
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">整合與設定</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Google Calendar section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-red-500 text-white text-xs flex items-center justify-center font-bold">G</span>
              Google Calendar
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">OAuth 用戶端 ID</label>
                <input
                  type="text"
                  value={inputClientId}
                  onChange={e => setInputClientId(e.target.value)}
                  placeholder="xxxxxx.apps.googleusercontent.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  在 <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-500 underline">Google Cloud Console</a> 建立 OAuth Client ID（Web 應用程式），並將 <code className="bg-slate-100 px-1 rounded">https://kuocj1.github.io</code> 加入已授權的 JavaScript 來源。
                </p>
              </div>
              <button
                onClick={saveClientId}
                disabled={!inputClientId.trim()}
                className="text-sm bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl font-medium transition-colors"
              >
                {saved ? '✓ 已儲存' : '儲存 Client ID'}
              </button>

              {clientId && (
                <div className="pt-1">
                  {isConnected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-600 font-medium">✓ 已連線 Google Calendar</span>
                      <button
                        onClick={disconnect}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors"
                      >
                        <LogOut size={13} />
                        中斷連線
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={connect}
                      disabled={!scriptsReady || isLoading}
                      className="flex items-center gap-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
                    >
                      <span className="w-4 h-4 rounded bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">G</span>
                      {isLoading ? '連線中...' : !scriptsReady ? '載入中...' : '連結 Google Calendar'}
                    </button>
                  )}
                  {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
              )}
            </div>
          </section>

          {/* Import / Export section */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Calendar size={15} className="text-indigo-500" />
              iCalendar 匯入／匯出
            </h3>
            <div className="flex gap-3">
              <button
                onClick={onExportIcs}
                className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl transition-colors"
              >
                <Download size={15} />
                匯出 .ics
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-sm border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl transition-colors"
              >
                <Upload size={15} />
                匯入 .ics
              </button>
              <input ref={fileRef} type="file" accept=".ics" className="hidden" onChange={handleImport} />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              匯出可匯入 Google Calendar、Apple 行事曆等應用。匯入支援標準 .ics 格式。
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
