import { useMemo, useRef, useState } from 'react';
import { CARD_PROMPT, parseCards } from '../lib/parse';
import { SAMPLE_TEXT } from '../lib/samples';
import { LEVEL_LABEL, type Card, type MindMap, type Note } from '../types';
import { downloadBackup, parseBackup, prepareImport } from '../lib/backup';
import { MAX_IMPORT_CARDS } from '../lib/limits';

interface Props {
  cards: Card[];
  notes: Note[];
  mindmaps: MindMap[];
  onImport: (cards: Card[], notes: Note[], mindmaps?: MindMap[]) => Promise<boolean>;
}

export function ImportPanel({ cards, notes, mindmaps, onImport }: Props) {
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => parseCards(text, { noteId: noteId || null }), [text, noteId]);

  const tooMany = preview.length > MAX_IMPORT_CARDS;

  async function addParsed() {
    if (tooMany) return;
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

  async function importJson(file: File) {
    try {
      const backup = parseBackup(await file.text());
      const total = backup.notes.length + backup.cards.length + backup.mindmaps.length;
      if (total === 0) {
        setMsg('가져올 자료가 없어요. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.');
        return;
      }
      const ready = prepareImport(backup, { notes, cards, mindmaps });
      if (await onImport(ready.cards, ready.notes, ready.mindmaps))
        setMsg(`개념 ${ready.notes.length}개, 카드 ${ready.cards.length}개, 마인드맵 ${ready.mindmaps.length}개를 가져왔어요.`);
    } catch (e) {
      setMsg(`가져오기 실패: ${e instanceof SyntaxError ? 'JSON 형식이 아니에요' : (e as Error).message}`);
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        새 주제를 처음부터 공부할 땐 <b>개념</b> 탭의 "새 개념"에서 노트와 카드를 한 번에 만드는 걸 추천해요. 여기는 카드만 빠르게 추가할 때 씁니다.
      </p>
      <section className="stack">
        <h3>1. AI로 공부한 뒤, 이 프롬프트를 보내세요</h3>
        <pre className="prompt">{CARD_PROMPT}</pre>
        <div className="row">
          <button onClick={copyPrompt}>{copied ? '복사됨!' : '프롬프트 복사'}</button>
        </div>
      </section>

      <section className="stack">
        <h3>2. AI 답변을 그대로 붙여넣기</h3>
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
          <button className="primary" onClick={addParsed} disabled={preview.length === 0 || tooMany}>
            카드로 추가
          </button>
        </div>
        {tooMany && (
          <p className="notice error">
            한 번에 {MAX_IMPORT_CARDS}개까지 추가할 수 있어요. 지금 {preview.length}개라서 나눠서 붙여넣어 주세요.
          </p>
        )}
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
        <p className="muted small">
          개념·카드·마인드맵을 파일로 저장해요. 내 백업을 가져오면 같은 자료는 덮어쓰고, 다른 사람이 공유한 파일은 내 자료로 새로
          추가돼요.
        </p>
        <div className="row">
          <button
            onClick={() => downloadBackup({ notes, cards, mindmaps })}
            disabled={cards.length === 0 && notes.length === 0 && mindmaps.length === 0}
          >
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
