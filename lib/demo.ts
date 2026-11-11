// Explicitly opt in locally; production always requires real authentication.
export function demoMode() {
  return process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTO_LOGIN === 'true';
}
export const demoUser = { id: 'local-demo', email: 'admin@wbify.com', role: 'admin' };
