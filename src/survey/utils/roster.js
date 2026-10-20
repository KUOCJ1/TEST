/** 把貼上的名單文字（每行「姓名,Email」或只有 Email）解析成 [{ name, email }]。 */
export function parseRoster(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 2) return { name: parts[0], email: parts[1] };
      return { name: '', email: parts[0] };
    })
    .filter((e) => e.email);
}
