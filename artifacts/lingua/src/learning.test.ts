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
  type MistakeItem,
  type ReviewItem,
  type StudySession,
  type VocabularyItem,
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

type VersionOneSnapshot = {
  version: number;
  languageId: string;
  dailyGoal: number;
  attempts: Attempt[];
  history: Record<string, number>;
  streak: number;
  lastPracticeDay: string | null;
  reviews: ReviewItem[];
  mistakes?: MistakeItem[];
  vocabulary: VocabularyItem[];
  sessions: StudySession[];
  seen: string[];
};

type VersionOnePreview =
  | { status: 'malformed' }
  | { status: 'unsupported-version'; version: number }
  | {
      status: 'ready';
      state: VersionOneSnapshot;
      attemptLanguageIds: (string | null)[];
      sessionLanguageIds: (string | null)[];
      reviewLanguageIds: (string | null)[];
      historyByLanguage: Record<string, Record<string, number>>;
      mistakes: MistakeItem[];
    };

const fixtureQuestion = questionBank.find(item => item.id === 'es-03')!;
const fixtureReviewDate = '2026-10-20T10:02:00.000Z';
const versionOneFixture: VersionOneSnapshot = {
  version: 1,
  languageId: 'pt',
  dailyGoal: 10,
  attempts: [
    { questionId: 'es-01', timestamp: '2026-10-19T10:01:00.000Z', correct: true, answer: 'Buenos días' },
    { questionId: 'es-03', timestamp: '2026-10-19T10:02:00.000Z', correct: false, answer: 'Buenos días' },
  ],
  history: { '2026-10-19': 2 },
  streak: 4,
  lastPracticeDay: '2026-10-19',
  reviews: [
    { questionId: 'es-03', dueAt: fixtureReviewDate, interval: 1, ease: 2.5, status: 'due' },
  ],
  mistakes: [{
    questionId: fixtureQuestion.id,
    originalQuestion: fixtureQuestion,
    userAnswer: 'Buenos días',
    correctAnswer: fixtureQuestion.accepted[0],
    explanation: fixtureQuestion.explanation,
    firstMissedAt: '2026-10-19T10:02:00.000Z',
    lastMissedAt: '2026-10-19T10:02:00.000Z',
    nextReviewAt: fixtureReviewDate,
    timesMissed: 1,
  }],
  vocabulary: [{
    word: 'la casa',
    translation: 'the house',
    example: 'La casa es grande.',
    languageId: 'es',
    savedAt: '2026-10-19T10:03:00.000Z',
  }],
  sessions: [{
    startedAt: '2026-10-19T10:00:00.000Z',
    completedAt: '2026-10-19T10:05:00.000Z',
    answered: 2,
    correct: 1,
  }],
  seen: ['es-01', 'es-03'],
};

// Test-only preview: describes candidate attribution from a copied snapshot.
// It never accesses localStorage or writes/deletes saved data.
const previewVersionOneAttribution = (raw: string): VersionOnePreview => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'malformed' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'malformed' };
  const state = parsed as VersionOneSnapshot;
  if (typeof state.version !== 'number') return { status: 'malformed' };
  if (state.version !== 1) return { status: 'unsupported-version', version: state.version };
  if (
    !Array.isArray(state.attempts)
    || !Array.isArray(state.reviews)
    || !Array.isArray(state.vocabulary)
    || !Array.isArray(state.sessions)
    || !Array.isArray(state.seen)
    || !state.history
    || typeof state.history !== 'object'
    || Array.isArray(state.history)
    || !Number.isFinite(state.streak)
  ) return { status: 'malformed' };

  const languageForQuestionId = (questionId: unknown): string | null =>
    typeof questionId === 'string'
      ? questionBank.find(question => question.id === questionId)?.languageId ?? null
      : null;
  const attemptLanguageIds = state.attempts.map(attempt => languageForQuestionId(attempt.questionId));
  const sessionLanguageIds = state.sessions.map(session => {
    if (!session.completedAt) return null;
    const startedAt = Date.parse(session.startedAt);
    const completedAt = Date.parse(session.completedAt);
    if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) return null;

    const sessionAttempts = state.attempts.filter(attempt => {
      const timestamp = Date.parse(attempt.timestamp);
      return Number.isFinite(timestamp) && timestamp >= startedAt && timestamp <= completedAt;
    });
    if (!sessionAttempts.length || sessionAttempts.length !== session.answered) return null;

    const languagesForSession = sessionAttempts.map(attempt => languageForQuestionId(attempt.questionId));
    if (languagesForSession.some(languageId => languageId === null)) return null;
    const uniqueLanguageIds = new Set(languagesForSession);
    return uniqueLanguageIds.size === 1 ? languagesForSession[0] : null;
  });
  const reviewLanguageIds = state.reviews.map(review => languageForQuestionId(review.questionId));
  const allAttemptsShareKnownLanguage = attemptLanguageIds.length > 0
    && attemptLanguageIds.every((languageId): languageId is string => languageId !== null)
    && new Set(attemptLanguageIds).size === 1;
  const historyByLanguage = allAttemptsShareKnownLanguage
    ? { [attemptLanguageIds[0]]: { ...state.history } }
    : {};
  const reviews = migrateReviewSources(state.reviews, state.attempts);
  const mistakes = state.mistakes ?? migrateLegacyMistakes(state.attempts, reviews);

  return {
    status: 'ready',
    state,
    attemptLanguageIds,
    sessionLanguageIds,
    reviewLanguageIds,
    historyByLanguage,
    mistakes,
  };
};

test('version-one fixture can be attributed without changing its saved fields or review dates', () => {
  const originalRaw = JSON.stringify(versionOneFixture);
  const result = previewVersionOneAttribution(originalRaw);

  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.deepEqual(result.attemptLanguageIds, ['es', 'es']);
  assert.deepEqual(result.sessionLanguageIds, ['es']);
  assert.deepEqual(result.reviewLanguageIds, ['es']);
  assert.deepEqual(result.historyByLanguage, { es: versionOneFixture.history });
  assert.equal(result.state.languageId, 'pt', 'selected language must not override question-ID attribution');
  assert.equal(result.state.dailyGoal, versionOneFixture.dailyGoal);
  assert.deepEqual(result.state.attempts, versionOneFixture.attempts);
  assert.deepEqual(result.state.history, versionOneFixture.history);
  assert.equal(result.state.streak, versionOneFixture.streak);
  assert.equal(result.state.lastPracticeDay, versionOneFixture.lastPracticeDay);
  assert.deepEqual(result.state.sessions, versionOneFixture.sessions);
  assert.deepEqual(result.state.vocabulary, versionOneFixture.vocabulary);
  assert.deepEqual(result.state.seen, versionOneFixture.seen);
  assert.deepEqual(result.state.reviews, versionOneFixture.reviews);
  assert.deepEqual(result.state.mistakes, versionOneFixture.mistakes);
  assert.equal(result.state.reviews[0].dueAt, fixtureReviewDate);
  assert.equal(result.mistakes[0].nextReviewAt, fixtureReviewDate);
  assert.equal(JSON.stringify(versionOneFixture), originalRaw, 'the source fixture copy must remain unchanged');
});

test('version-one records with unknown question IDs stay preserved but unattributed', () => {
  const unknownAttempt: Attempt = {
    questionId: 'retired-question-99',
    timestamp: '2026-10-19T10:31:00.000Z',
    correct: true,
    answer: 'legacy answer',
  };
  const fixtureWithUnknownId = {
    ...versionOneFixture,
    attempts: [...versionOneFixture.attempts, unknownAttempt],
    history: { '2026-10-19': 3 },
    sessions: [
      ...versionOneFixture.sessions,
      { startedAt: '2026-10-19T10:30:00.000Z', completedAt: '2026-10-19T10:35:00.000Z', answered: 1, correct: 1 },
    ],
  };
  const originalRaw = JSON.stringify(fixtureWithUnknownId);
  const result = previewVersionOneAttribution(originalRaw);

  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.deepEqual(result.attemptLanguageIds, ['es', 'es', null]);
  assert.deepEqual(result.sessionLanguageIds, ['es', null]);
  assert.deepEqual(result.historyByLanguage, {}, 'ambiguous aggregate history should not be assigned by guess');
  assert.equal(result.state.attempts[2].questionId, 'retired-question-99');
  assert.deepEqual(result.state.history, { '2026-10-19': 3 });
  assert.equal(JSON.stringify(fixtureWithUnknownId), originalRaw);
});

test('malformed and unknown-version snapshots are reported without altering their copies', () => {
  const malformedRaw = '{"version":1,"attempts":';
  const malformed = previewVersionOneAttribution(malformedRaw);
  assert.deepEqual(malformed, { status: 'malformed' });
  assert.equal(malformedRaw, '{"version":1,"attempts":');

  const malformedShapeRaw = JSON.stringify({ ...versionOneFixture, attempts: 'not-an-array' });
  assert.deepEqual(previewVersionOneAttribution(malformedShapeRaw), { status: 'malformed' });
  assert.equal(JSON.parse(malformedShapeRaw).attempts, 'not-an-array');

  const unknownVersionRaw = JSON.stringify({ ...versionOneFixture, version: 7 });
  const unsupported = previewVersionOneAttribution(unknownVersionRaw);
  assert.deepEqual(unsupported, { status: 'unsupported-version', version: 7 });
  assert.equal(JSON.parse(unknownVersionRaw).version, 7);
});

test('partially populated version-one snapshot without mistakes can rebuild them without losing its due date', () => {
  const { mistakes: _omitted, ...partialFixture } = versionOneFixture;
  const originalRaw = JSON.stringify(partialFixture);
  const result = previewVersionOneAttribution(originalRaw);

  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  assert.equal('mistakes' in result.state, false, 'preview does not rewrite the source snapshot');
  assert.equal(result.mistakes.length, 1);
  assert.equal(result.mistakes[0].questionId, 'es-03');
  assert.equal(result.mistakes[0].nextReviewAt, fixtureReviewDate);
  assert.equal(JSON.stringify(partialFixture), originalRaw);
});
