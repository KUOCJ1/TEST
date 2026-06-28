import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { REGISTRY } from '../data/assessments/index.js';
import { buildResult } from '../utils/scoring.js';

const RATER_TYPE_OPTIONS = [
  { value: 'self',        label: '自評 (self)' },
  { value: 'manager',     label: '主管 (manager)' },
  { value: 'peer',        label: '同儕 (peer)' },
  { value: 'subordinate', label: '部屬 (subordinate)' },
];

const RATER_TYPE_SET = new Set(RATER_TYPE_OPTIONS.map((o) => o.value));

function generateTemplateCsv(config) {
  const allQIds = config.ALL_QUESTIONS.map((q) => q.id);
  const header = ['ratee_email', 'ratee_name', 'rater_type', 'rater_email', 'rater_name', ...allQIds];
  const exampleSelf = [
    'example@company.com', '王小明', 'self', '', '',
    ...allQIds.map(() => '3'),
  ];
  const exampleMgr = [
    'example@company.com', '王小明', 'manager', 'boss@company.com', '李經理',
    ...allQIds.map(() => '4'),
  ];
  const rows = [header, exampleSelf, exampleMgr];
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
    const rateeName = String(row['ratee_name'] ?? '').trim();
    const raterType = String(row['rater_type'] ?? '').trim().toLowerCase();
    const raterEmail = String(row['rater_email'] ?? '').trim().toLowerCase();
    const raterName = String(row['rater_name'] ?? '').trim();

    if (!rateeEmail) { errors.push({ row: rowNum, message: '缺少 ratee_email' }); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rateeEmail)) { errors.push({ row: rowNum, message: `ratee_email 格式錯誤: ${rateeEmail}` }); continue; }
    if (!RATER_TYPE_SET.has(raterType)) { errors.push({ row: rowNum, message: `rater_type 必須為 self/manager/peer/subordinate，目前為: "${raterType}"` }); continue; }
    if (raterType !== 'self' && !raterEmail) { errors.push({ row: rowNum, message: `rater_type="${raterType}" 時需填寫 rater_email` }); continue; }
    if (raterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raterEmail)) { errors.push({ row: rowNum, message: `rater_email 格式錯誤: ${raterEmail}` }); continue; }

    const answers = {};
    let invalidCount = 0;
    for (const q of config.ALL_QUESTIONS) {
      const raw = row[q.id];
      if (raw === '' || raw === null || raw === undefined) { continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < config.SCALE_MIN || n > config.SCALE_MAX) { invalidCount++; continue; }
      answers[q.id] = n;
    }

    const answered = Object.keys(answers).length;
    if (answered === 0) { errors.push({ row: rowNum, message: '沒有任何有效答題資料' }); continue; }
    if (invalidCount > 0) errors.push({ row: rowNum, message: `${invalidCount} 題答案超出量表範圍（${config.SCALE_MIN}–${config.SCALE_MAX}）已略過` });

    const result = buildResult(answers, config);

    results.push({
      _rowNum: rowNum,
      rateeEmail,
      rateeName: rateeName || rateeEmail.split('@')[0],
      raterType,
      raterEmail: raterType === 'self' ? rateeEmail : raterEmail,
      raterName: raterType === 'self' ? (rateeName || rateeEmail.split('@')[0]) : (raterName || raterEmail.split('@')[0]),
      answers,
      result,
      answeredCount: answered,
      totalQuestions: config.TOTAL_QUESTIONS,
    });
  }
  return { results, errors };
}

export default function BatchUploadSection() {
  const [assessmentId, setAssessmentId] = useState(Object.keys(REGISTRY)[0]);
  const [parsedRows, setParsedRows] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const config = REGISTRY[assessmentId];

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
    <section className="mb-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-1 text-sm font-semibold text-slate-500">批次上傳評測資料</h3>
      <p className="mb-4 text-xs text-slate-400">
        支援 CSV 與 Excel (.xlsx)。先下載範本，填寫後上傳，系統將自動計算分數並建立填答紀錄。
        若 Email 不存在，將自動建立帳號（無密碼），可事後透過重設密碼連結讓用戶登入查看報告。
      </p>

      {/* Step 1: select assessment + download template */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">選擇評量</label>
          <select
            value={assessmentId}
            onChange={(e) => { setAssessmentId(e.target.value); handleClear(); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
          >
            {Object.entries(REGISTRY).map(([id, cfg]) => (
              <option key={id} value={id}>{cfg.NAME}</option>
            ))}
          </select>
        </div>
        <div className="pt-5">
          <button
            type="button"
            onClick={handleTemplate}
            className="rounded-lg border border-brand-300 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
          >
            ⬇ 下載範本 CSV
          </button>
        </div>
      </div>

      {/* Template format hint */}
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p className="mb-1 font-semibold text-slate-600">範本欄位說明</p>
        <div className="grid gap-y-0.5 sm:grid-cols-2">
          <span><code className="rounded bg-white px-1">ratee_email</code> 受測者 Email（必填）</span>
          <span><code className="rounded bg-white px-1">ratee_name</code> 受測者姓名</span>
          <span><code className="rounded bg-white px-1">rater_type</code> self / manager / peer / subordinate（必填）</span>
          <span><code className="rounded bg-white px-1">rater_email</code> 評分者 Email（非自評時必填）</span>
          <span><code className="rounded bg-white px-1">rater_name</code> 評分者姓名（選填）</span>
          <span><code className="rounded bg-white px-1">{config.ALL_QUESTIONS[0]?.id} … {config.ALL_QUESTIONS[config.ALL_QUESTIONS.length - 1]?.id}</code> 各題答案 {config.SCALE_MIN}–{config.SCALE_MAX}</span>
        </div>
      </div>

      {/* Step 2: upload file */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-500">上傳填寫好的檔案</label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            {fileName ? `已選擇：${fileName}` : '選擇 CSV / Excel 檔'}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
          {fileName && (
            <button type="button" onClick={handleClear} className="text-xs text-slate-400 hover:text-red-400">✕ 清除</button>
          )}
        </div>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-700">解析警告（以下列有誤，將不會上傳）</p>
          <ul className="space-y-0.5 text-xs text-amber-600">
            {parseErrors.slice(0, 20).map((e, i) => (
              <li key={i}>第 {e.row} 列：{e.message}</li>
            ))}
            {parseErrors.length > 20 && <li>… 共 {parseErrors.length} 筆錯誤</li>}
          </ul>
        </div>
      )}

      {/* Preview parsed rows */}
      {parsedRows && parsedRows.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            預覽（共 {parsedRows.length} 筆有效資料，可上傳；{parseErrors.length} 筆有誤將略過）
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-500">列</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">受測者 Email</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">受測者姓名</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">評分者類型</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">評分者 Email</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">已答題數</th>
                  <th className="px-3 py-2 font-semibold text-slate-500">總分</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 10).map((r) => (
                  <tr key={r._rowNum} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-400">{r._rowNum}</td>
                    <td className="px-3 py-1.5 text-slate-700">{r.rateeEmail}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.rateeName}</td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${
                        r.raterType === 'self' ? 'bg-brand-50 text-brand-700' :
                        r.raterType === 'manager' ? 'bg-blue-50 text-blue-700' :
                        r.raterType === 'peer' ? 'bg-green-50 text-green-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {raterTypeLabel(r.raterType)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{r.raterType === 'self' ? '—' : r.raterEmail}</td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {r.answeredCount}/{r.totalQuestions}
                      {r.answeredCount < r.totalQuestions && (
                        <span className="ml-1 text-amber-500">（部分作答）</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-bold text-slate-800">{r.result.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 10 && (
              <p className="px-3 py-2 text-xs text-slate-400">… 還有 {parsedRows.length - 10} 筆</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="mt-3 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {uploading ? '上傳中…' : `確認上傳 ${parsedRows.length} 筆資料`}
          </button>
        </div>
      )}

      {parsedRows?.length === 0 && (
        <p className="mb-3 text-sm text-amber-600">檔案中沒有可解析的有效資料，請確認欄位名稱與格式。</p>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {uploadError}
        </p>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700">
            上傳完成：成功匯入 {uploadResult.added} 筆
            {uploadResult.usersCreated > 0 && `，自動建立 ${uploadResult.usersCreated} 個新帳號`}
          </p>
          {uploadResult.usersCreated > 0 && (
            <p className="mt-1 text-xs text-emerald-600">
              新帳號尚無密碼，請透過「用戶管理」的「重設密碼」功能，產生連結後發送給用戶。
            </p>
          )}
          {uploadResult.errors?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-amber-600">{uploadResult.errors.length} 筆匯入失敗：</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-600">
                {uploadResult.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>第 {e.row} 列：{e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
