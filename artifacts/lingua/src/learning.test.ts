import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePracticeAccuracy,
  contentRegistry,
  isReviewDue,
  languages,
  migrateLegacyMistakes,
  migrateReviewSources,
  questionBank,
  scheduleReviewAt,
  upsertMistake,
  validateContentRegistry,
  type Attempt,
  type ContentRegistry,
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

test('content registry maps supported languages while keeping only Spanish lessons available', () => {
  assert.deepEqual(validateContentRegistry(), []);
  assert.deepEqual(Object.keys(contentRegistry).sort(), languages.map(language => language.id).sort());
  assert.equal(contentRegistry.es.language.availability, 'ready');
  assert.deepEqual(contentRegistry.es.questions, questionBank);
  assert.equal(contentRegistry.es.questions.length, 30);
  assert.equal(contentRegistry.pt.language.locale, 'pt-PT');
  assert.equal(contentRegistry.pt.language.availability, 'coming');
  assert.deepEqual(contentRegistry.pt.questions, []);
  assert.equal(contentRegistry.fr.language.locale, 'fr-FR');
  assert.equal(contentRegistry.fr.language.availability, 'coming');
  assert.deepEqual(contentRegistry.fr.questions, []);
});

test('content registry validation rejects unsupported and missing language IDs', () => {
  const missingFrench = { ...contentRegistry };
  delete missingFrench.fr;
  assert.ok(validateContentRegistry(missingFrench).some(error => error.includes('Missing content registry entry for supported language "fr"')));

  const withUnsupportedLanguage = {
    ...contentRegistry,
    de: contentRegistry.es,
  };
  assert.ok(validateContentRegistry(withUnsupportedLanguage).some(error => error.includes('Unsupported language ID "de"')));

  const unsupportedQuestion = {
    ...contentRegistry,
    es: {
      ...contentRegistry.es,
      questions: [{ ...question, languageId: 'de' }, ...contentRegistry.es.questions.slice(1)],
    },
  } satisfies ContentRegistry;
  assert.ok(validateContentRegistry(unsupportedQuestion).some(error => error.includes('Question "es-01" uses unsupported language ID "de"')));
});

test('content registry validation rejects mismatched banks and duplicate question IDs', () => {
  const mismatchedBank = {
    ...contentRegistry,
    pt: {
      ...contentRegistry.pt,
      questions: [question],
    },
  } satisfies ContentRegistry;
  assert.ok(validateContentRegistry(mismatchedBank).some(error => error.includes('belongs to "es" but is listed under "pt"')));

  const duplicateQuestion = {
    ...contentRegistry,
    es: {
      ...contentRegistry.es,
      questions: [...contentRegistry.es.questions, question],
    },
  } satisfies ContentRegistry;
  assert.ok(validateContentRegistry(duplicateQuestion).some(error => error.includes('Duplicate question ID "es-01"')));
});
