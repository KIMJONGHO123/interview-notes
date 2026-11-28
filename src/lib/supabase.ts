import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경변수가 없으면 null → 앱은 브라우저 저장(로컬 모드)으로 동작 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export type Provider = 'github' | 'google';
export const PROVIDER_LABEL: Record<Provider, string> = { github: 'GitHub', google: 'Google' };

/** 소셜 로그인 시작. 로그인 후 지금 사이트(배포 주소 또는 localhost)로 돌아옴 */
export const signInWith = (db: SupabaseClient, provider: Provider) =>
  db.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });

/**
 * Supabase 대시보드에서 켜 둔 로그인 방법.
 * Google 은 대시보드에서 켜야 버튼이 보임 (켜기 전에 누르면 오류가 나므로).
 */
export async function enabledProviders(): Promise<Provider[]> {
  if (!url || !key) return ['github'];
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    const list = (['github', 'google'] as Provider[]).filter((p) => external?.[p]);
    return list.length ? list : ['github'];
  } catch {
    return ['github'];
  }
}
