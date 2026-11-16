import { useMemo, useRef, useState } from 'react';
import { CARD_PROMPT, parseCards } from '../lib/parse';
import { SAMPLE_TEXT } from '../lib/samples';
import { LEVEL_LABEL, normalizeCard, type Card, type Note } from '../types';

interface Props {
  cards: Card[];
  notes: Note[];
  onImport: (cards: Card[], notes: Note[]) => Promise<boolean>;
}

export function ImportPanel({ cards, notes, onImport }: Props) {
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => parseCards(text, { noteId: noteId || null }), [text, noteId]);

  async function addParsed() {
    if (await onImport(preview, [])) {
      setMsg(`${preview.length}개 카드를 추가했어요.`);
      setText('');
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(CARD_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportJson() {
    const data = { version: 2, exportedAt: new Date().toISOString(), notes, cards };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interview-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text());
      // v1: 카드 배열, v2: { notes, cards }
      const rawCards: unknown[] = Array.isArray(data) ? data : data.cards ?? [];
      const rawNotes: unknown[] = Array.isArray(data) ? [] : data.notes ?? [];
      const validCards = (rawCards as Card[])
        .filter((c) => c && typeof c.id === 'string' && typeof c.question === 'string')
        .map(normalizeCard);
      const validNotes = (rawNotes as Note[]).filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string');
      if (await onImport(validCards, validNotes))
        setMsg(`개념 ${validNotes.length}개, 카드 ${validCards.length}개를 가져왔어요. (같은 id는 덮어씀)`);
    } catch (e) {
      setMsg(`가져오기 실패: ${(e as Error).message}`);
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        새 주제를 처음부터 공부할 땐 <b>개념</b> 탭의 "새 개념"에서 노트와 카드를 한 번에 만드는 걸 추천해요. 여기는 카드만 빠르게 추가할 때 씁니다.
      </p>
      <section className="stack">
        <h3>1. GPT로 공부한 뒤, 이 프롬프트를 보내세요</h3>
        <pre className="prompt">{CARD_PROMPT}</pre>
        <div className="row">
          <button onClick={copyPrompt}>{copied ? '복사됨!' : '프롬프트 복사'}</button>
        </div>
      </section>

      <section className="stack">
        <h3>2. GPT 답변을 그대로 붙여넣기</h3>
        <textarea
          rows={10}
          placeholder={'Q: 질문\nA: 답변\n꼬리: 꼬리질문\n태그: 트랜잭션, DB\n난이도: 면접'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label>
          연결할 개념 노트 <span className="muted">(선택)</span>
          <select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
            <option value="">(연결 안 함)</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <span className="muted small">인식된 카드 {preview.length}개</span>
          <span className="spacer" />
          <button onClick={() => setText(SAMPLE_TEXT)}>예시 넣기</button>
          <button className="primary" onClick={addParsed} disabled={preview.length === 0}>
            카드로 추가
          </button>
        </div>
        {preview.length > 0 && (
          <ul className="preview">
            {preview.map((c) => (
              <li key={c.id}>
                <span className="level">{LEVEL_LABEL[c.level]}</span> {c.question}{' '}
                <span className="muted small">
                  · 꼬리 {c.followUps.length} · {c.tags.map((t) => `#${t}`).join(' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {msg && <p className="notice">{msg}</p>}

      <section className="stack">
        <h3>백업</h3>
        <div className="row">
          <button onClick={exportJson} disabled={cards.length === 0 && notes.length === 0}>
            JSON 내보내기
          </button>
          <button onClick={() => fileRef.current?.click()}>JSON 가져오기</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
    </div>
  );
}
