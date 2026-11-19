import { INTERVIEW_TARGET_SEC, formatSec, speakSeconds } from '../types';

/** 면접 답변의 예상 말하기 시간 (권장 30초) */
export function SpeakMeter({ text }: { text: string }) {
  const sec = speakSeconds(text);
  const ratio = sec / INTERVIEW_TARGET_SEC;
  const state = ratio > 1.5 ? 'over' : ratio > 1 ? 'warn' : 'ok';
  const msg =
    state === 'over'
      ? '너무 길어요. 핵심만 남기고 나머지는 꼬리질문으로 옮겨 보세요.'
      : state === 'warn'
        ? '조금 길어요. 30초 안으로 줄여 보세요.'
        : sec === 0
          ? '첫 문장에 결론, 다음에 근거나 예시 하나.'
          : '좋아요. 30초 안에 말할 수 있는 분량이에요.';
  return (
    <div className={`speak ${state}`}>
      <div className="row small">
        <span>🗣 약 {formatSec(sec)}</span>
        <span className="muted">/ 권장 {formatSec(INTERVIEW_TARGET_SEC)}</span>
        <span className="spacer" />
        <span className="speak-msg">{msg}</span>
      </div>
      <div className="speak-bar">
        <div style={{ width: `${Math.min(100, ratio * 66.7)}%` }} />
        <i style={{ left: '66.7%' }} title="30초" />
      </div>
    </div>
  );
}
