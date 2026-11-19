import { useMemo, useState } from 'react';
import { CONCEPT_PROMPT, hasCardSection, parseCards, splitNote } from '../lib/parse';
import { SAMPLE_CONCEPT } from '../lib/samples';
import type { Card, Note } from '../types';
import { Markdown } from './Markdown';
import { LIMITS, MAX_IMPORT_CARDS } from '../lib/limits';

interface Props {
  note: Note;
  isNew: boolean;
  onSave: (note: Note, newCards: Card[]) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, isNew, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [body, setBody] = useState(note.body);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const tagList = useMemo(() => [...new Set(tags.split(',').map((s) => s.trim()).filter(Boolean))], [tags]);

  // 본문에 ===카드=== 가 있으면 노트/카드 분리
  const parsed = useMemo(() => {
    if (!hasCardSection(body)) return null;
    const { title: t, body: b, cardText } = splitNote(body);
    return { title: t, body: b, cards: parseCards(cardText, { noteId: note.id }) };
  }, [body, note.id]);

  const finalTitle = title.trim() || parsed?.title || splitNote(body).title;
  const tooManyCards = (parsed?.cards.length ?? 0) > MAX_IMPORT_CARDS;
  const bodyTooLong = (parsed ? parsed.body : body).length > LIMITS.noteBody;

  function save() {
    if (!finalTitle || tooManyCards || bodyTooLong) return;
    const split = splitNote(body);
    const cardTags = (c: Card) => [...new Set([...c.tags, ...tagList])];
    onSave(
      {
        ...note,
        title: finalTitle,
        // 제목을 따로 입력했으면 본문의 # 제목 줄도 제거된 버전 사용
        body: parsed ? parsed.body : title.trim() ? body.trim() : split.body,
        tags: tagList,
        updatedAt: new Date().toISOString(),
      },
      (parsed?.cards ?? []).map((c) => ({ ...c, tags: cardTags(c) })),
    );
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(CONCEPT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal wide stack" onClick={(e) => e.stopPropagation()}>
        {isNew && (
          <div className="helper">
            <p>
              <b>GPT로 개념 정리하기:</b> 프롬프트를 복사해 주제만 바꿔 보내고, 답변 전체를 아래 본문에 붙여넣으세요.
              <code>===카드===</code> 아래 부분은 이 노트에 연결된 카드로 자동 추가됩니다.
            </p>
            <div className="row">
              <button onClick={copyPrompt}>{copied ? '복사됨!' : '개념 정리 프롬프트 복사'}</button>
              {!body && <button onClick={() => setBody(SAMPLE_CONCEPT)}>트랜잭션 예시 넣기</button>}
            </div>
          </div>
        )}

        <label>
          제목 <span className="muted">(비워두면 본문의 첫 "# 제목" 사용)</span>
          <input maxLength={LIMITS.noteTitle} value={title} placeholder={parsed?.title || splitNote(body).title || '예: 트랜잭션 기초'} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          태그 <span className="muted">(쉼표로 구분, 함께 만들어지는 카드에도 붙음)</span>
          <input value={tags} placeholder="트랜잭션, DB" onChange={(e) => setTags(e.target.value)} />
        </label>

        <div className="row">
          <b className="small">본문 (마크다운)</b>
          <span className="spacer" />
          <div className="seg">
            <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>
              쓰기
            </button>
            <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>
              미리보기
            </button>
          </div>
        </div>
        {preview ? (
          <div className="preview-box">
            <Markdown text={parsed ? parsed.body : body} />
          </div>
        ) : (
          <textarea className="mono" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
        )}

        {parsed && (
          <p className="notice">
            저장하면 카드 {parsed.cards.length}개가 함께 추가됩니다 (📘 기초 {parsed.cards.filter((c) => c.level === 'basic').length} · 📗 심화{' '}
            {parsed.cards.filter((c) => c.level === 'advanced').length} · 🎤 면접 {parsed.cards.filter((c) => c.level === 'interview').length}).
          </p>
        )}

        {bodyTooLong && (
          <p className="notice error">
            노트 본문은 {LIMITS.noteBody.toLocaleString()}자까지 저장할 수 있어요. (지금{' '}
            {(parsed ? parsed.body : body).length.toLocaleString()}자)
          </p>
        )}
        {tooManyCards && (
          <p className="notice error">
            함께 추가하는 카드는 {MAX_IMPORT_CARDS}개까지예요. 지금 {parsed!.cards.length}개라서 나눠서 추가해 주세요.
          </p>
        )}

        <div className="row end">
          <span className="spacer" />
          <button onClick={onCancel}>취소</button>
          <button className="primary" onClick={save} disabled={!finalTitle || tooManyCards || bodyTooLong}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
