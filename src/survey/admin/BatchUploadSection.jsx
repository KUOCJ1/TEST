import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ChevronUp, ChevronDown, Download, Check, X } from 'lucide-react';
import { api } from '../api/client';
import { REGISTRY } from '../data/assessments/index.js';
import { buildResult } from '../utils/scoring.js';
import { RATER_LABELS, RATER_COLORS as RATER_COLOR } from '../constants/raterTypes';

const RATER_TYPE_OPTIONS = [
  { value: 'self',        en: 'self',        desc: '由受測者本人填寫，rater_email 可留空（系統自動填入受測者 Email）' },
  { value: 'manager',     en: 'manager',     desc: '由受測者的直屬主管填寫，需填寫主管的 rater_email' },
  { value: 'peer',        en: 'peer',        desc: '由同階同事或橫向協作夥伴填寫，需填寫同事的 rater_email' },
  { value: 'subordinate', en: 'subordinate', desc: '由受測者的直屬部屬填寫，需填寫部屬的 rater_email' },
].map((o) => ({ ...o, label: RATER_LABELS[o.value] }));

const RATER_TYPE_SET = new Set(RATER_TYPE_OPTIONS.map((o) => o.value));

function generateTemplateCsv(config) {
  const allQIds = config.ALL_QUESTIONS.map((q) => q.id);
  const header = ['ratee_email', 'ratee_name', 'rater_type', 'rater_email', 'rater_name', ...allQIds];
  const exampleSelf = ['example@company.com', '王小明', 'self', '', '', ...allQIds.map(() => '3')];
  const exampleMgr  = ['example@company.com', '王小明', 'manager', 'boss@company.com', '李經理', ...allQIds.map(() => '4')];
  const examplePeer = ['example@company.com', '王小明', 'peer', 'peer@company.com', '陳小華', ...allQIds.map(() => '4')];
  const exampleSub  = ['example@company.com', '王小明', 'subordinate', 'sub@company.com', '張小芳', ...allQIds.map(() => '5')];
  const rows = [header, exampleSelf, exampleMgr, examplePeer, exampleSub];
  return rows.map((r) => r.map((v) => (String(v).includes(',') ? `"${v}"` : v)).join(',')).join('\r\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch {
        reject(new Error('檔案解析失敗，請確認格式正確'));
      }
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsArrayBuffer(file);
  });
}

function validateAndScore(rawRows, config) {
  const results = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    const rateeEmail = String(row['ratee_email'] ?? '').trim().toLowerCase();
    const rateeName  = String(row['ratee_name']  ?? '').trim();
    const raterType  = String(row['rater_type']  ?? '').trim().toLowerCase();
    const raterEmail = String(row['rater_email'] ?? '').trim().toLowerCase();
    const raterName  = String(row['rater_name']  ?? '').trim();

    if (!rateeEmail) { errors.push({ row: rowNum, message: '缺少 ratee_email' }); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rateeEmail)) { errors.push({ row: rowNum, message: `ratee_email 格式錯誤：${rateeEmail}` }); continue; }
    if (!RATER_TYPE_SET.has(raterType)) { errors.push({ row: rowNum, message: `rater_type 必須為 self / manager / peer / subordinate，目前值：「${raterType}」` }); continue; }
    if (raterType !== 'self' && !raterEmail) { errors.push({ row: rowNum, message: `rater_type="${raterType}" 時，rater_email 不可為空` }); continue; }
    if (raterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raterEmail)) { errors.push({ row: rowNum, message: `rater_email 格式錯誤：${raterEmail}` }); continue; }

    const answers = {};
    let invalidCount = 0;
    for (const q of config.ALL_QUESTIONS) {
      const raw = row[q.id];
      if (raw === '' || raw === null || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < config.SCALE_MIN || n > config.SCALE_MAX) { invalidCount++; continue; }
      answers[q.id] = n;
    }

    const answered = Object.keys(answers).length;
    if (answered === 0) { errors.push({ row: rowNum, message: '未偵測到任何有效答題資料，請確認題目欄位名稱是否與範本一致' }); continue; }
    if (invalidCount > 0) errors.push({ row: rowNum, message: `${invalidCount} 題答案超出量表範圍（${config.SCALE_MIN}–${config.SCALE_MAX}），已略過不計分` });

    const result = buildResult(answers, config);

    results.push({
      _rowNum: rowNum,
      rateeEmail,
      rateeName: rateeName || rateeEmail.split('@')[0],
      raterType,
      raterEmail: raterType === 'self' ? rateeEmail : raterEmail,
      raterName:  raterType === 'self' ? (rateeName || rateeEmail.split('@')[0]) : (raterName || raterEmail.split('@')[0]),
      answers,
      result,
      answeredCount: answered,
      totalQuestions: config.TOTAL_QUESTIONS,
    });
  }
  return { results, errors };
}

function ColTag({ children }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-brand-700">{children}</code>;
}

export default function BatchUploadSection() {
  const [assessmentId, setAssessmentId] = useState(Object.keys(REGISTRY)[0]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const config = REGISTRY[assessmentId];
  const firstQId = config.ALL_QUESTIONS[0]?.id;
  const lastQId  = config.ALL_QUESTIONS[config.ALL_QUESTIONS.length - 1]?.id;
  const totalQ   = config.ALL_QUESTIONS.length;

  const handleTemplate = () => {
    const csv = generateTemplateCsv(config);
    downloadCsv(csv, `範本_${config.NAME}_批次上傳.csv`);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsedRows(null);
    setParseErrors([]);
    setUploadResult(null);
    setUploadError('');
    try {
      const rawRows = await parseFile(file);
      const { results, errors } = validateAndScore(rawRows, config);
      setParsedRows(results);
      setParseErrors(errors);
    } catch (err) {
      setUploadError(err.message);
    }
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!parsedRows?.length) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    try {
      const result = await api.batchImport({
        assessmentId,
        rows: parsedRows.map(({ rateeEmail, rateeName, raterType, raterEmail, raterName, answers, result: r }) => ({
          rateeEmail, rateeName, raterType, raterEmail, raterName, answers, result: r,
        })),
      });
      setUploadResult(result);
      setParsedRows(null);
      setFileName('');
    } catch (err) {
      setUploadError(err.message || '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setParsedRows(null);
    setParseErrors([]);
    setUploadResult(null);
    setUploadError('');
    setFileName('');
  };

  const raterTypeLabel = (t) => RATER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

  return (
    <section className="mb-5 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">

      {/* ── Header ── */}
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-700">批次上傳評測資料</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              支援 CSV 與 Excel (.xlsx)。上傳前請先下載範本，依格式填寫後再行匯入。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="btn-ghost btn-sm border border-slate-200"
          >
            {guideOpen ? <>收起說明 <ChevronUp className="h-3.5 w-3.5" /></> : <>查看詳細說明 <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      </div>

      {/* ── Detailed Guide (collapsible) ── */}
      {guideOpen && (
        <div className="border-b border-slate-100 px-5 py-5 space-y-5 bg-slate-50/60">

          {/* Overview */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-700">功能說明</h4>
            <p className="text-xs leading-relaxed text-slate-600">
              此功能讓管理者可將線下收集的問卷資料（紙本掃描、外部系統匯出）大量匯入平台。
              系統將自動計算各構面分數與落點等級，並產生與線上填答完全一致的報告。
              每次最多可上傳 <strong>2,000 筆</strong>，不限次數上傳。
            </p>
          </div>

          {/* Step flow */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-slate-700">操作步驟</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', title: '下載範本', body: '選擇評量後點「下載範本 CSV」，以 Excel 或試算表軟體開啟並填寫。' },
                { n: '2', title: '填寫並上傳', body: '依格式填入受測者/評分者資訊與各題答案（1–5 分），存檔後上傳至平台。' },
                { n: '3', title: '確認匯入', body: '系統自動驗證與計分，顯示預覽後確認上傳，匯入結果將即時顯示。' },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column format */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-700">欄位格式說明</h4>
            <p className="mb-2 text-xs text-slate-500">
              CSV 第一列必須為欄位名稱（英文，大小寫不敏感）。以下為各欄位規格：
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600">欄位名稱</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">必填</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">說明</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">範例</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-white">
                    <td className="px-3 py-2"><ColTag>ratee_email</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">必填</span></td>
                    <td className="px-3 py-2 text-slate-600">受測者（被評估的人）的 Email。若帳號不存在，系統將自動建立。</td>
                    <td className="px-3 py-2 text-slate-400">wang@company.com</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2"><ColTag>ratee_name</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">選填</span></td>
                    <td className="px-3 py-2 text-slate-600">受測者姓名。若帳號不存在且此欄留空，將使用 Email @ 前段作為名稱。</td>
                    <td className="px-3 py-2 text-slate-400">王小明</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2"><ColTag>rater_type</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">必填</span></td>
                    <td className="px-3 py-2 text-slate-600">評分者身份。固定為以下四種英文值之一（見下方說明）。</td>
                    <td className="px-3 py-2 text-slate-400">self</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2"><ColTag>rater_email</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">條件必填</span></td>
                    <td className="px-3 py-2 text-slate-600">評分者 Email。<strong>rater_type 為 self 時可留空</strong>（自動填入受測者 Email）；其他類型必填。</td>
                    <td className="px-3 py-2 text-slate-400">boss@company.com</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2"><ColTag>rater_name</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">選填</span></td>
                    <td className="px-3 py-2 text-slate-600">評分者姓名。留空時使用 rater_email @ 前段作為名稱。</td>
                    <td className="px-3 py-2 text-slate-400">李經理</td>
                  </tr>
                  <tr className="bg-brand-50/40">
                    <td className="px-3 py-2"><ColTag>{firstQId}</ColTag> … <ColTag>{lastQId}</ColTag></td>
                    <td className="px-3 py-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">至少填一題</span></td>
                    <td className="px-3 py-2 text-slate-600">
                      各題作答，共 <strong>{totalQ} 欄</strong>，欄位名稱與範本完全一致。
                      值為整數 {config.SCALE_MIN}–{config.SCALE_MAX}，未填視為跳題（允許部分作答）。
                    </td>
                    <td className="px-3 py-2 text-slate-400">3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rater type table */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-700">rater_type 說明</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {RATER_TYPE_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${RATER_COLOR[o.value]}`}>
                    {o.label}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-600"><ColTag>{o.en}</ColTag></p>
                    <p className="mt-0.5 text-xs text-slate-500">{o.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div>
            <h4 className="mb-2 text-sm font-bold text-slate-700">答題量表（{config.SCALE_MIN}–{config.SCALE_MAX} 分）</h4>
            <div className="flex flex-wrap gap-2">
              {config.SCALE_LABELS?.map((s) => (
                <div key={s.value} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{s.value}</span>
                  <span className="text-xs text-slate-600">{s.label}</span>
                </div>
              )) ?? (
                <p className="text-xs text-slate-500">整數 {config.SCALE_MIN}–{config.SCALE_MAX}，每格一題。</p>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              注意：評量中含有「反向題」，系統將自動進行反向計分，填寫時請依實際情況填答，<strong>無需手動換算</strong>。
            </p>
          </div>

          {/* New user note */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="mb-1 text-xs font-bold text-blue-700">關於自動建立帳號</p>
            <ul className="space-y-1 text-xs text-blue-600">
              <li>若受測者或評分者的 Email 在平台中不存在，系統將自動建立帳號（標記為「匯入帳號」）。</li>
              <li>自動建立的帳號<strong>無密碼</strong>，用戶無法直接登入。</li>
              <li>上傳完成後，請至「用戶管理」找到對應用戶，點「重設密碼」產生連結並發送給用戶，讓其自行設定密碼後即可登入查看報告。</li>
            </ul>
          </div>

          {/* Common mistakes */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1 text-xs font-bold text-amber-700">常見錯誤</p>
            <ul className="space-y-1 text-xs text-amber-700">
              <li>欄位名稱有空格或大小寫不符（須與範本<strong>完全一致</strong>）</li>
              <li>rater_type 填中文（必須填英文：self / manager / peer / subordinate）</li>
              <li>答案欄填入非數字（如「是」「N/A」等），這些格填將被略過</li>
              <li>Excel 存檔時選擇格式非 .xlsx 或 .csv（請勿使用 .xls 舊版格式）</li>
              <li>多份評量混在同一檔案中——每次上傳前請先選擇正確評量，再上傳對應的資料</li>
            </ul>
          </div>

        </div>
      )}

      {/* ── Main workflow ── */}
      <div className="px-5 py-5 space-y-5">

        {/* Step 1 */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">步驟 1 — 選擇評量並下載範本</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">評量</label>
              <select
                value={assessmentId}
                onChange={(e) => { setAssessmentId(e.target.value); handleClear(); }}
                className="input w-auto"
              >
                {Object.entries(REGISTRY).map(([id, cfg]) => (
                  <option key={id} value={id}>{cfg.NAME}（{cfg.TOTAL_QUESTIONS} 題）</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleTemplate}
              className="btn-secondary"
            >
              <Download className="h-4 w-4" /> 下載範本 CSV
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            範本含 5 個欄位說明欄 + {totalQ} 道題目欄（<ColTag>{firstQId}</ColTag> 至 <ColTag>{lastQId}</ColTag>），並附 4 筆示範資料列。
          </p>
        </div>

        {/* Step 2 */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">步驟 2 — 上傳填寫完成的檔案</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer">
              {fileName
                ? <><Check className="h-4 w-4 text-brand-600" /> {fileName}</>
                : '選擇 CSV / Excel 檔案'}
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            {fileName && (
              <button type="button" onClick={handleClear} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
                <X className="h-3.5 w-3.5" /> 重新選擇
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">支援 .csv 及 .xlsx（Excel）格式，單次最多 2,000 筆資料列。</p>
        </div>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1.5 text-xs font-bold text-amber-700">
              解析警告 — {parseErrors.length} 列有問題，已自動略過（不影響其他列上傳）
            </p>
            <ul className="space-y-1 text-xs text-amber-600">
              {parseErrors.slice(0, 20).map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold">第 {e.row} 列</span>
                  <span>{e.message}</span>
                </li>
              ))}
              {parseErrors.length > 20 && <li className="text-amber-500">… 共 {parseErrors.length} 筆，請修正後重新上傳</li>}
            </ul>
          </div>
        )}

        {/* Empty result */}
        {parsedRows?.length === 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            <p className="font-bold">未找到任何有效資料</p>
            <p className="mt-1">可能原因：欄位名稱與範本不符、答題欄全部留空、或檔案為空白。請確認後重新上傳。</p>
          </div>
        )}

        {/* Preview */}
        {parsedRows && parsedRows.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              步驟 3 — 確認預覽並上傳
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                有效資料 {parsedRows.length} 筆
              </span>
              {parseErrors.length > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                  略過 {parseErrors.length} 筆（有誤）
                </span>
              )}
            </div>

            <p className="mb-1 text-xs text-slate-400 sm:hidden">← 左右滑動可查看完整欄位</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['列號', '受測者 Email', '受測者姓名', '評分者類型', '評分者 Email', '答題數', '總分', '落點等級'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 15).map((r) => (
                    <tr key={r._rowNum} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{r._rowNum}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{r.rateeEmail}</td>
                      <td className="px-3 py-2 text-slate-600">{r.rateeName}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${RATER_COLOR[r.raterType]}`}>
                          {raterTypeLabel(r.raterType)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {r.raterType === 'self' ? <span className="text-slate-300">—（同受測者）</span> : r.raterEmail}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.answeredCount}/{r.totalQuestions}
                        {r.answeredCount < r.totalQuestions && (
                          <span className="ml-1 text-amber-500">部分</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800">{r.result.total}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                          style={{ background: r.result.level?.color ?? '#6b7280' }}>
                          {r.result.level?.badge ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 15 && (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                  … 還有 {parsedRows.length - 15} 筆未顯示
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary"
              >
                {uploading ? '上傳中…' : `確認匯入 ${parsedRows.length} 筆`}
              </button>
              <button type="button" onClick={handleClear}
                className="btn-ghost">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {uploadError}
          </div>
        )}

        {/* Upload result */}
        {uploadResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-bold text-emerald-700">
              匯入完成
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-emerald-600">{uploadResult.added}</p>
                <p className="text-xs text-slate-500">成功匯入筆數</p>
              </div>
              <div className="rounded-lg bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-2xl font-extrabold text-blue-600">{uploadResult.usersCreated}</p>
                <p className="text-xs text-slate-500">自動建立新帳號數</p>
              </div>
            </div>
            {uploadResult.usersCreated > 0 && (
              <p className="mt-3 text-xs text-emerald-700">
                新建帳號尚無密碼，請至下方「用戶管理」找到對應帳號，點「重設密碼」產生登入連結後轉發給用戶。
              </p>
            )}
            {uploadResult.errors?.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-700">{uploadResult.errors.length} 筆後端匯入失敗：</p>
                <ul className="mt-1 space-y-0.5 text-xs text-amber-600">
                  {uploadResult.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>第 {e.row} 列：{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
