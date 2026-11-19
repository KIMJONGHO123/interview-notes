import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경변수가 없으면 null → 앱은 브라우저 저장(로컬 모드)으로 동작 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** GitHub 로그인 시작. 로그인 후 지금 사이트(배포 주소 또는 localhost)로 돌아옴 */
export const signInWithGitHub = (db: SupabaseClient) =>
  db.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } });
