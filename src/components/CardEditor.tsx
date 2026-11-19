import { useState } from 'react';
import { CONFIDENCE_LABEL, isConcept, type Card, type Confidence, type FollowUp, type Level, type Note } from '../types';
import { LIMITS } from '../lib/limits';
import { SpeakMeter } from './SpeakMeter';

interface Props {
  card: Card;
  notes: Note[];
  onSave: (card: Card) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function CardEditor({ card, notes, onSave, onCancel, onDelete }: Props) {
  const [level, setLevel] = useState<Level>(card.level);
  const [noteId, setNoteId] = useState<string>(card.noteId ?? '');
  const [question, setQuestion] = useState(card.question);
  const [answer, setAnswer] = useState(card.answer);
  const [followUps, setFollowUps] = useState<FollowUp[]>(card.followUps.map((f) => ({ ...f })));
  const updateFollowUp = (i: number, patch: Partial<FollowUp>) =>
    setFollowUps((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const removeFollowUp = (i: number) => setFollowUps((list) => list.filter((_, j) => j !== i));
  const moveFollowUp = (i: number, d: -1 | 1) =>
    setFollowUps((list) => {
      const next = [...list];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const [project, setProject] = useState(card.project);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [confidence, setConfidence] = useState<Confidence>(card.confidence);
  const interview = !isConcept(level);
  // 개념 카드도 꼬리질문이나 프로젝트 내용이 이미 있으면 보여줌
  const showFollowUps = interview || followUps.length > 0;
  const showProject = interview || !!project;

  function save() {
    if (!question.trim()) return;
    onSave({
      ...card,
      question: question.trim(),
      answer: answer.trim(),
      followUps: followUps.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q),
      project: project.trim(),
      tags: [...new Set(tags.split(',').map((s) => s.trim()).filter(Boolean))],
      confidence,
      level,
      noteId: noteId || null,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div className="seg">
            <button className={!interview ? 'on' : ''} onClick={() => !isConcept(level) && setLevel('basic')}>
              📘 개념
            </button>
            <button className={interview ? 'on' : ''} onClick={() => setLevel('interview')}>
              🎤 면접
            </button>
          </div>
          {!interview && (
            <div className="seg">
              {(['basic', 'advanced'] as Level[]).map((l) => (
                <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
                  {l === 'basic' ? '기초' : '심화'}
                </button>
              ))}
            </div>
          )}
          <span className="muted small">
            {level === 'basic'
              ? '정의·용어 확인 (짧게)'
              : level === 'advanced'
                ? '동작 원리·설계 이유 (깊게)'
                : '실제 면접 질문 (30초 답변 + 꼬리질문)'}
          </span>
        </div>
        <label>
          개념 노트
          <select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
            <option value="">(연결 안 함)</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          질문
          <textarea rows={2} maxLength={LIMITS.cardQuestion} value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
        </label>
        <label>
          {interview ? (
            <>
              내 답변 <span className="muted">(말로 30초, 깊은 내용은 꼬리질문으로)</span>
            </>
          ) : (
            <>
              답변 <span className="muted">{level === 'advanced' ? '(원리까지 깊게)' : '(1~2줄)'}</span>
            </>
          )}
          <textarea rows={interview ? 5 : 6} maxLength={LIMITS.cardAnswer} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
        {interview && <SpeakMeter text={answer} />}
        {!showFollowUps && (
          <div>
            <button className="link small" onClick={() => setFollowUps([{ q: '', a: '' }])}>
              + 꼬리질문 추가
            </button>
          </div>
        )}
        {showFollowUps && <div className="stack fu-editor">
          <div className="row">
            <b className="small">꼬리질문</b>
            <span className="muted small">면접관이 이어서 물어볼 질문과 내 답</span>
          </div>
          {followUps.map((f, i) => (
            <div key={i} className="fu-row">
              <div className="fu-num">{i + 1}</div>
              <div className="stack grow">
                <input maxLength={LIMITS.cardQuestion} placeholder="꼬리질문" value={f.q} onChange={(e) => updateFollowUp(i, { q: e.target.value })} />
                <textarea rows={2} maxLength={2000} placeholder="답 (1~2줄)" value={f.a} onChange={(e) => updateFollowUp(i, { a: e.target.value })} />
              </div>
              <div className="fu-actions">
                <button title="위로" disabled={i === 0} onClick={() => moveFollowUp(i, -1)}>
                  ↑
                </button>
                <button title="아래로" disabled={i === followUps.length - 1} onClick={() => moveFollowUp(i, 1)}>
                  ↓
                </button>
                <button title="삭제" className="danger" onClick={() => removeFollowUp(i)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div>
            <button disabled={followUps.length >= LIMITS.followUps} onClick={() => setFollowUps((list) => [...list, { q: '', a: '' }])}>+ 꼬리질문 추가</button>
          </div>
        </div>}
        {showProject && (
          <label>
            내 프로젝트와 연결 <span className="muted">(어디에, 왜 썼는지)</span>
            <textarea rows={2} maxLength={LIMITS.cardProject} value={project} onChange={(e) => setProject(e.target.value)} />
          </label>
        )}
        <label>
          태그 <span className="muted">(쉼표로 구분)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <div className="row">
          <span>자신감</span>
          {(['low', 'mid', 'high'] as Confidence[]).map((c) => (
            <button key={c} className={`chip conf-${c} ${confidence === c ? 'on' : ''}`} onClick={() => setConfidence(c)}>
              {CONFIDENCE_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="row end">
          {onDelete && (
            <button className="danger" onClick={onDelete}>
              삭제
            </button>
          )}
          <span className="spacer" />
          <button onClick={onCancel}>취소</button>
          <button className="primary" onClick={save} disabled={!question.trim()}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
