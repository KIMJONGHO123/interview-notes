import { newCard, splitFollowUp, type Card, type Confidence, type Level } from '../types';

/**
 * GPT 정리 결과를 카드로 변환.
 *
 * Q: 질문            (새 카드 시작)
 * A: 답변            (여러 줄 가능 - 접두어 없는 줄은 앞 항목에 이어붙임)
 * 꼬리: 꼬리질문 (답)  (여러 번 가능 - 끝의 괄호가 답)
 * 꼬리답: 답          (괄호 대신 다음 줄에 답을 써도 됨)
 * 프로젝트: 내 프로젝트 연결
 * 태그: 트랜잭션, DB
 * 난이도: 기초/면접
 * 자신감: 상/중/하
 */
const FIELD_RE = /^\s*(Q|질문|A|답|답변|꼬리답변|꼬리답|꼬리질문|꼬리|프로젝트|태그|난이도|자신감)\s*[:：]\s*(.*)$/i;

type Field = 'q' | 'a' | 'f' | 'fa' | 'p' | 't' | 'l' | 'c';

function fieldOf(label: string): Field {
  const l = label.toLowerCase();
  if (l === 'q' || l === '질문') return 'q';
  if (l === 'a' || l === '답' || l === '답변') return 'a';
  if (l.startsWith('꼬리답')) return 'fa';
  if (l.startsWith('꼬리')) return 'f';
  if (l === '프로젝트') return 'p';
  if (l === '태그') return 't';
  if (l === '난이도') return 'l';
  return 'c';
}

function toConfidence(v: string): Confidence {
  const s = v.trim();
  if (s === '상' || s === 'high') return 'high';
  if (s === '하' || s === 'low') return 'low';
  return 'mid';
}

const toLevel = (v: string): Level => (/기초|basic/i.test(v) ? 'basic' : 'interview');

export function parseCards(text: string, defaults: Partial<Card> = {}): Card[] {
  const cards: Card[] = [];
  let cur: Card | null = null;
  let last: Field | null = null;

  const append = (base: string, line: string) => (base ? `${base}\n${line}` : line);

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.replace(/^\s*[-*]\s+(?=(Q|A|꼬리|프로젝트|태그|난이도|자신감)\s*[:：])/i, '').replace(/^\*\*(.+?)\*\*/, '$1');
    const m = line.match(FIELD_RE);

    if (m) {
      const field = fieldOf(m[1]);
      const value = m[2].trim();
      if (field === 'q') {
        cur = newCard({ ...defaults, question: value, tags: [...(defaults.tags ?? [])] });
        cards.push(cur);
      } else if (cur) {
        if (field === 'a') cur.answer = append(cur.answer, value);
        if (field === 'f' && value) cur.followUps.push({ q: value, a: '' });
        if (field === 'fa' && cur.followUps.length) cur.followUps[cur.followUps.length - 1].a = value;
        if (field === 'p') cur.project = append(cur.project, value);
        if (field === 't')
          cur.tags = [...new Set([...cur.tags, ...value.split(/[,#]/).map((t) => t.trim()).filter(Boolean)])];
        if (field === 'l') cur.level = toLevel(value);
        if (field === 'c') cur.confidence = toConfidence(value);
      }
      last = field;
      continue;
    }

    // 접두어 없는 줄 → 직전 항목에 이어붙이기
    if (!cur || line.trim() === '---') continue;
    const t = line.trimEnd();
    if (last === 'q') cur.question = append(cur.question, t);
    else if (last === 'a') cur.answer = append(cur.answer, t);
    else if (last === 'p') cur.project = append(cur.project, t);
    else if ((last === 'f' || last === 'fa') && cur.followUps.length && t.trim()) {
      const f = cur.followUps[cur.followUps.length - 1];
      if (last === 'f') f.q += ` ${t.trim()}`;
      else f.a = append(f.a, t.trim());
    }
  }

  return cards
    .map((c) => ({
      ...c,
      question: c.question.trim(),
      answer: c.answer.trim(),
      project: c.project.trim(),
      // "꼬리답:" 이 없으면 "질문 (답)" 의 끝 괄호를 답으로 분리
      followUps: c.followUps.map((f) => (f.a ? f : splitFollowUp(f.q))),
    }))
    .filter((c) => c.question);
}

const CARD_SPLIT_RE = /^\s*={3,}\s*카드\s*={3,}\s*$/m;

/**
 * 개념 노트 붙여넣기 분리:
 *   # 제목          → title
 *   본문(마크다운)   → body
 *   ===카드===      → 이후는 카드 형식
 */
export function splitNote(text: string): { title: string; body: string; cardText: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  const [notePart, ...rest] = normalized.split(CARD_SPLIT_RE);
  const cardText = rest.join('\n');
  const lines = notePart.split('\n');
  const titleIdx = lines.findIndex((l) => /^#\s+\S/.test(l));
  let title = '';
  if (titleIdx !== -1 && lines.slice(0, titleIdx).every((l) => !l.trim())) {
    title = lines[titleIdx].replace(/^#\s+/, '').trim();
    lines.splice(titleIdx, 1);
  }
  return { title, body: lines.join('\n').trim(), cardText };
}

export const hasCardSection = (text: string) => CARD_SPLIT_RE.test(text);

export const CONCEPT_PROMPT = `[주제: 여기에 입력]에 대해 면접 준비 전에 기초부터 제대로 이해하고 싶어.
아래 형식의 마크다운으로만 답해줘. 비전공자도 이해할 수 있게 쉽게, 하지만 정확하게.

# 주제 이름
## 한 줄 정의
## 왜 필요한가
(이게 없으면 어떤 문제가 생기는지 구체적인 상황으로)
## 핵심 개념
(하위 개념들을 소제목/표로 정리)
## 예시
(실제 코드나 SQL, 또는 일상 비유)
## 헷갈리기 쉬운 점
## 연관 개념
(다음에 공부하면 좋은 개념)

===카드===
위 내용을 확인하는 카드를 만들어줘. 기초 4~6개, 면접 2~4개.
카드 사이는 빈 줄로 구분하고 이 형식만 사용:

Q: 질문
A: 답변 (기초는 1~2줄, 면접은 30초 분량 3~5줄 구어체)
꼬리: 꼬리질문 (핵심 답 1~2줄)   ← 면접 카드에만, 2~3개
태그: 태그1, 태그2
난이도: 기초 또는 면접`;

export const CARD_PROMPT = `방금 공부한 내용을 면접 대비 카드로 정리해줘. 아래 형식만 사용하고 다른 말은 쓰지 마.
- 카드 하나당 질문 하나
- 개념 확인용은 난이도: 기초 (답 1~2줄), 실제 면접 질문은 난이도: 면접 (30초 분량 3~5줄, 구어체)
- 면접 카드에는 면접관이 이어서 물어볼 꼬리질문 2~3개 (질문 끝 괄호 안에 핵심 답 1~2줄)
- 카드 사이는 빈 줄로 구분

Q: 질문
A: 답변
꼬리: 꼬리질문 (핵심 답)
태그: 태그1, 태그2
난이도: 면접`;
