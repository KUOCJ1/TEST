import { readFileSync } from 'fs';
import { marked } from 'marked';
import { chromium } from 'playwright';

const md = readFileSync(new URL('../docs/user-manual.md', import.meta.url), 'utf8');
const body = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 18mm; }
  body { font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Arial Unicode MS", sans-serif;
         font-size: 11pt; line-height: 1.75; color: #1e293b; }
  h1 { font-size: 22pt; border-bottom: 2px solid #2563eb; padding-bottom: 8px;
       color: #1e3a8a; margin-top: 0; page-break-after: avoid; }
  h2 { font-size: 15pt; color: #1d4ed8; margin-top: 28px; margin-bottom: 6px;
       page-break-after: avoid; border-left: 4px solid #3b82f6; padding-left: 10px; }
  h3 { font-size: 12pt; color: #2563eb; margin-top: 18px; page-break-after: avoid; }
  h4 { font-size: 11pt; color: #3b82f6; margin-top: 14px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt;
          page-break-inside: avoid; }
  th { background: #eff6ff; color: #1e40af; text-align: left;
       padding: 7px 10px; border: 1px solid #bfdbfe; font-weight: 600; }
  td { padding: 6px 10px; border: 1px solid #dbeafe; vertical-align: top; }
  tr:nth-child(even) td { background: #f8faff; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
         font-family: "Courier New", monospace; font-size: 9.5pt; }
  pre { background: #f1f5f9; padding: 12px; border-radius: 6px;
        font-size: 9pt; overflow: hidden; border-left: 3px solid #94a3b8; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #93c5fd; margin: 10px 0; padding: 6px 14px;
               background: #eff6ff; color: #1e40af; border-radius: 0 4px 4px 0; }
  ul, ol { padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  a { color: #2563eb; text-decoration: none; }
  p { margin: 6px 0; }
  strong { color: #0f172a; }
</style>
</head>
<body>${body}</body>
</html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : '/opt/pw-browsers/chromium',
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: 'public/user-manual.pdf',
  format: 'A4',
  printBackground: true,
});
await browser.close();
console.log('PDF generated: public/user-manual.pdf');
