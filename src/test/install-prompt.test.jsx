import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallPrompt from '../survey/pwa/InstallPrompt.jsx';
import { detectPlatform, isStandalone, isSnoozed, snooze, SNOOZE_DAYS } from '../survey/pwa/installPrompt.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  iphoneLine: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.1.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  androidLine: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Line/14.1.0',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
const setUA = (ua) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

describe('平台判斷', () => {
  it('iPhone Safari／其他瀏覽器／App 內建瀏覽器／Android／iPad／桌機', () => {
    expect(detectPlatform(UA.iphoneSafari, 5)).toBe('ios-safari');
    expect(detectPlatform(UA.iphoneChrome, 5)).toBe('ios-other');
    expect(detectPlatform(UA.iphoneLine, 5)).toBe('in-app');
    expect(detectPlatform(UA.androidLine, 5)).toBe('in-app');
    expect(detectPlatform(UA.android, 5)).toBe('android');
    expect(detectPlatform(UA.ipad, 5)).toBe('ios-safari'); // iPadOS 偽裝成 Mac，靠觸控點數判斷
    expect(detectPlatform(UA.ipad, 0)).toBe('desktop');
    expect(detectPlatform(UA.desktop, 0)).toBe('desktop');
  });
  it('已從主畫面開啟（standalone）', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
  });
  it(`關掉後 ${SNOOZE_DAYS} 天內不再提示，之後恢復`, () => {
    localStorage.clear();
    expect(isSnoozed()).toBe(false);
    snooze(1000);
    expect(isSnoozed(1000 + 29 * 864e5)).toBe(true);
    expect(isSnoozed(1000 + 31 * 864e5)).toBe(false);
  });
});

describe('InstallPrompt', () => {
  const origUA = window.navigator.userAgent;
  beforeEach(() => { localStorage.clear(); window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); });
  afterEach(() => { setUA(origUA); delete window.navigator.standalone; vi.restoreAllMocks(); });

  it('iPhone Safari：顯示「分享 → 加入主畫面」三個步驟；關閉後不再顯示', () => {
    setUA(UA.iphoneSafari);
    const { container, unmount } = render(<InstallPrompt />);
    expect(screen.getByRole('region', { name: '安裝到手機' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(container.textContent).toContain('加入主畫面');
    fireEvent.click(screen.getByRole('button', { name: '關閉安裝提示' }));
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(render(<InstallPrompt />).container).toBeEmptyDOMElement(); // 重新進來也不顯示
  });
  it('LINE 內建瀏覽器：請使用者改用預設瀏覽器開啟', () => {
    setUA(UA.iphoneLine);
    render(<InstallPrompt />);
    expect(screen.getByText(/用預設瀏覽器開啟/)).toBeInTheDocument();
  });
  it('已經從主畫面開啟：不顯示（橫幅與個人設定都不顯示）', () => {
    setUA(UA.iphoneSafari);
    window.navigator.standalone = true;
    expect(render(<InstallPrompt />).container).toBeEmptyDOMElement();
    expect(render(<InstallPrompt variant="card" />).container).toBeEmptyDOMElement();
  });
  it('桌機沒有安裝事件：不顯示', () => {
    setUA(UA.desktop);
    expect(render(<InstallPrompt />).container).toBeEmptyDOMElement();
    expect(render(<InstallPrompt variant="card" />).container).toBeEmptyDOMElement();
  });
  it('Android：瀏覽器給了安裝事件才出現「安裝」鈕，按下會跳出安裝對話框；接受後顯示已安裝', async () => {
    setUA(UA.android);
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement(); // 還沒有事件
    const ev = new Event('beforeinstallprompt');
    ev.prompt = vi.fn().mockResolvedValue();
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    await act(async () => { window.dispatchEvent(ev); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '安裝' })); });
    expect(ev.prompt).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/已安裝/)).toBeInTheDocument();
  });
  it('個人設定的常駐說明：關過橫幅的人仍看得到', () => {
    setUA(UA.iphoneSafari);
    snooze();
    expect(render(<InstallPrompt />).container).toBeEmptyDOMElement();
    render(<InstallPrompt variant="card" />);
    expect(screen.getByRole('region', { name: '安裝到手機' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '關閉安裝提示' })).toBeNull();
  });
});
