import { useContext } from 'react';
import { AuthContext } from '../auth/authContextObject';

/**
 * 目前登入的是不是試用帳號（推廣期自行註冊，見 server/src/lib/trial.js）。
 * 不在 AuthProvider 內（例如單獨渲染元件的測試）時視為否。
 */
export function useIsTrial() {
  const ctx = useContext(AuthContext);
  return Boolean(ctx?.user?.trial);
}
