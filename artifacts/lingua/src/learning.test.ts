import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePracticeAccuracy,
  isReviewDue,
  migrateLegacyMistakes,
  migrateReviewSources,
  questionBank,
  scheduleReviewAt,
  upsertMistake,
  type Attempt,
  type ReviewItem,
} from './learning.ts';

const question = questionBank.find(item => item.id === 'es-01')!;
const practiceQuestion = questionBank.find(item => item.id === 'es-02')!;

test('practice accuracy uses the same recorded attempts and rounds consistently', () => {
  const attempts = [
    { questionId: question.id, timestamp: '2026-10-19T10:00:00.000Z', correct: true, answer: 'Buenos días' },
    { questionId: question.id, timestamp: '2026-10-19T10:01:00.000Z', correct: false, answer: 'Buenas noches' },
    { questionId: practiceQuestion.id, timestamp: '2026-10-19T10:02:00.000Z', correct: true, answer: 'Hola, ¿cómo estás?' },
  ] satisfies Attempt[];

  assert.equal(calculatePracticeAccuracy(attempts), 67);
  assert.equal(calculatePracticeAccuracy([]), null);
});

test('a review becomes due at its stored timestamp, not before', () => {
  const dueAt = '2026-10-20T10:00:00.000Z';
  const review = { dueAt };

  assert.equal(isReviewDue(review, Date.parse(dueAt) - 1), false);
  assert.equal(isReviewDue(review, Date.parse(dueAt)), true);
  assert.equal(isReviewDue({ dueAt: 'not-a-date' }, Date.parse(dueAt)), false);
});

test('legacy migration restores real mistakes without promoting practice reviews', () => {
  const attempts: Attempt[] = [
    { questionId: question.id, timestamp: '2026-10-19T10:00:00.000Z', correct: false, answer: 'Buenas noches' },
    { questionId: practiceQuestion.id, timestamp: '2026-10-19T10:01:00.000Z', correct: true, answer: 'Hola, ¿cómo estás?' },
  ];
  const reviews: ReviewItem[] = [
    { questionId: question.id, dueAt: '2026-10-20T10:00:00.000Z', interval: 1, ease: 2.5, status: 'due' },
    { questionId: practiceQuestion.id, dueAt: '2026-10-21T10:00:00.000Z', interval: 2, ease: 2.6, status: 'learning' },
  ];

  const sourcedReviews = migrateReviewSources(reviews, attempts);
  const mistakes = migrateLegacyMistakes(attempts, sourcedReviews);

  assert.equal(sourcedReviews[0].source, 'mistake');
  assert.equal(sourcedReviews[1].source, 'practice');
  assert.equal(mistakes.length, 1);
  assert.equal(mistakes[0].originalQuestion.prompt, question.prompt);
  assert.equal(mistakes[0].userAnswer, 'Buenas noches');
  assert.equal(mistakes[0].correctAnswer, 'Buenos días');
  assert.equal(mistakes[0].explanation, question.explanation);
  assert.equal(mistakes[0].nextReviewAt, reviews[0].dueAt);
});

test('repeated misses update the same notebook record and retain the first miss date', () => {
  const firstMissedAt = '2026-10-19T10:00:00.000Z';
  const firstDueAt = scheduleReviewAt(firstMissedAt, 1);
  const first = upsertMistake([], question, 'Buenas noches', firstMissedAt, firstDueAt);
  const secondMissedAt = '2026-10-20T10:00:00.000Z';
  const second = upsertMistake(first, question, 'Buenas tardes', secondMissedAt, scheduleReviewAt(secondMissedAt, 1));

  assert.equal(second.length, 1);
  assert.equal(second[0].firstMissedAt, firstMissedAt);
  assert.equal(second[0].lastMissedAt, secondMissedAt);
  assert.equal(second[0].userAnswer, 'Buenas tardes');
  assert.equal(second[0].timesMissed, 2);
});
