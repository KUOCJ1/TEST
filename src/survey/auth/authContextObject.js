import { createContext } from 'react';

// 登入狀態的 React context 本身。獨立成一個檔，讓不需要 useAuth 例外行為的地方
// （例如 trial/useIsTrial.js）可以直接讀；useAuth.js 會再匯出它。
export const AuthContext = createContext(null);
