export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// توجيه المستخدم مباشرة إلى Google OAuth بدلاً من Manus OAuth
export const getLoginUrl = () => {
  return `${window.location.origin}/api/oauth/google/login`;
};
