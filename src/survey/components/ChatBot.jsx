import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { readJSON, writeJSON, removeKey } from '../utils/storage';

const STORAGE_KEY = 'aiassess_chat_v1';

function getWelcomeContent(role) {
  if (role === 'coach') return '你好！我是教練助理。我可以幫你草擬學員評語、分析能力落點，請描述需求。';
  if (role === 'admin') return '你好！我是平台助理。有任何統計數據或系統操作問題，請直接詢問。';
  return '你好！我是評測小幫手。有任何關於評測結果或學習方向的問題，歡迎直接問我。';
}

export default function ChatBot({ context = null }) {
  const { isAdmin, isCoach } = useAuth();
  const role = isAdmin ? 'admin' : isCoach ? 'coach' : 'user';

  const makeWelcome = useCallback(
    () => ({ role: 'assistant', content: getWelcomeContent(role), _local: true }),
    [role],
  );

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = readJSON(STORAGE_KEY, null);
    return Array.isArray(saved) && saved.length ? saved : [makeWelcome()];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages, streamingText]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);
    setStreamingText('');

    const apiMessages = newMessages
      .filter((m) => !m._local)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI 服務暫時無法使用');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
            full += delta;
            setStreamingText(full);
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant', content: full }];
      setMessages(finalMessages);
      writeJSON(STORAGE_KEY, finalMessages.slice(-50));
    } catch (e) {
      setError(e.message || 'AI 服務暫時無法使用');
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearMessages = () => {
    removeKey(STORAGE_KEY);
    setMessages([makeWelcome()]);
    setError('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end print:hidden">
      {open && (
        <div className="mb-3 flex h-[520px] w-80 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center justify-between rounded-t-2xl bg-brand-600 px-4 py-3">
            <span className="text-sm font-semibold text-white">AI 評測小幫手</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearMessages}
                className="rounded px-2 py-0.5 text-xs font-medium text-brand-200 hover:bg-brand-700 hover:text-white"
              >
                清除對話
              </button>
              <button
                type="button"
                aria-label="關閉 AI 助手"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-brand-200 hover:bg-brand-700 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && !streamingText && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-400">
                  正在思考…
                </div>
              </div>
            )}
            {streaming && streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {streamingText}
                  <span className="animate-pulse">▌</span>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder="輸入問題…（Enter 送出，Shift+Enter 換行）"
                className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || streaming}
                className="self-end rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                送出
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? '關閉 AI 助手' : '開啟 AI 助手'}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          }
        </svg>
      </button>
    </div>
  );
}
