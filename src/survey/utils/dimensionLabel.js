/**
 * 構面在表格／圖表上的短標籤。題庫的 subtitle 有的是英文（Communication、Task Management…），
 * 在教練端表格與手機上又長又不直覺：英文的改用中文名稱；本來就是中文的副標維持原樣。
 */
export function dimLabel(d) {
  const sub = d?.subtitle ?? '';
  if (d?.name && /^[\x20-\x7e]+$/.test(sub)) return d.name;
  return sub || d?.name || '';
}
