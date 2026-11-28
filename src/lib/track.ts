import { supabase } from './supabase';

/**
 * 가입 흐름 측정용 이벤트 (supabase/schema.sql 의 events 테이블).
 * 개인을 알아볼 수 있는 정보는 보내지 않고, 브라우저마다 만든 무작위 id 만 씀.
 * DB 의 check 제약과 이름 목록이 같아야 함.
 */
export type EventName =
  | 'landing_view'
  | 'try_reveal'
  | 'try_rate'
  | 'demo_start'
  | 'signup_click'
  | 'review_done'
  | 'signup_prompt_view'
  | 'onboarded';

const VID_KEY = 'study-vid';

function visitor() {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

/** 실패해도 화면에는 영향 없음 */
export function track(name: EventName, detail?: string) {
  if (!supabase || import.meta.env.DEV) return;
  supabase
    .from('events')
    .insert({ name, visitor: visitor(), detail: detail?.slice(0, 40) ?? null })
    .then(
      () => {},
      () => {},
    );
}

/** 브라우저 탭마다 한 번만 */
export function trackOnce(name: EventName, detail?: string) {
  const key = `study-tracked-${name}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* 저장 못 하면 그냥 보냄 */
  }
  track(name, detail);
}
