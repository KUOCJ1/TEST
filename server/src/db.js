import fs from 'node:fs';
import path from 'node:path';

/**
 * 極簡檔案型 JSON 儲存：載入時讀入記憶體，每次變更後以「先寫暫存檔再 rename」的
 * 原子寫入方式落地，避免寫到一半當機造成資料毀損。適合課程規模、低併發的使用情境。
 *
 * @param {string} file 資料檔路徑；傳入 ':memory:' 或空字串則為純記憶體模式（測試用）。
 */
export function createDb(file) {
  const memory = !file || file === ':memory:';
  const data = { users: [], submissions: [], assessments: [], groups: [] };

  if (!memory && fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      data.users = Array.isArray(parsed.users) ? parsed.users : [];
      data.submissions = Array.isArray(parsed.submissions) ? parsed.submissions : [];
      data.assessments = Array.isArray(parsed.assessments) ? parsed.assessments : [];
      data.groups = Array.isArray(parsed.groups) ? parsed.groups : [];
    } catch {
      // 檔案毀損時以空資料啟動，避免整個服務無法上線。
    }
  }

  if (data.assessments.length === 0) {
    data.assessments = [
      { id: 'ai-competency', name: 'AI 全方位職能實戰課前評測', description: '6 大構面、31 題李克特量表', enabled: true },
      { id: 'leadership-9d', name: '經贏® 領導力九大構面行為評量', description: '9 大構面、90 題，含反向題', enabled: true },
    ];
  }

  function persist() {
    if (memory) return;
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  return { data, persist };
}
