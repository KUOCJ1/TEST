import { describe, it, expect, beforeEach } from 'vitest';
import { clearPersonalLocalData } from '../survey/utils/storage';

describe('登出時清掉個人資料', () => {
  beforeEach(() => localStorage.clear());

  it('清掉作答草稿、AI 對話、教練評語草稿與範本，保留深色模式這類裝置偏好', () => {
    localStorage.setItem('aiassess_draft_u1_ai-competency_v3', '{}');
    localStorage.setItem('aiassess_chat_v1', '[]');
    localStorage.setItem('aiassess_comment_draft_s1_v1', '{}');
    localStorage.setItem('aiassess_comment_templates_v1', '[]');
    localStorage.setItem('aiassess_dark', '"1"');
    localStorage.setItem('other_site_key', 'x');
    clearPersonalLocalData();
    expect(Object.keys(localStorage).sort()).toEqual(['aiassess_dark', 'other_site_key']);
  });
});
