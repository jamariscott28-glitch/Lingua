export type Language = { id: string; name: string; locale: string; availability: 'ready' | 'coming' };
export type LearningSkill = 'reading' | 'writing' | 'listening' | 'speaking';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Question = {
  id: string; languageId: string; topic: string;
  format: 'multiple-choice' | 'translation' | 'grammar' | 'free-text';
  prompt: string; choices?: string[]; accepted: string[]; explanation: string;
  word: string; translation: string; example: string;
  skill?: LearningSkill; cefrLevel?: CefrLevel;
};
export type LanguageContentBank = { language: Language; questions: readonly Question[] };
export type ContentRegistry = Record<string, LanguageContentBank>;
export type Attempt = { questionId: string; timestamp: string; correct: boolean; answer: string };
export type ReviewSource = 'mistake' | 'practice';
export type ReviewItem = { questionId: string; dueAt: string; interval: number; ease: number; status: 'due' | 'learning'; source?: ReviewSource };
export type MistakeItem = {
  questionId: string; originalQuestion: Question; userAnswer: string; correctAnswer: string;
  explanation: string; firstMissedAt: string; lastMissedAt: string; nextReviewAt: string; timesMissed: number;
};
export type VocabularyItem = { word: string; translation: string; example: string; languageId: string; savedAt: string };
export type StudySession = { startedAt: string; completedAt: string | null; answered: number; correct: number };
export type LinguaState = {
  version: number; languageId: string; dailyGoal: number; attempts: Attempt[];
  history: Record<string, number>; streak: number; lastPracticeDay: string | null;
  reviews: ReviewItem[]; mistakes: MistakeItem[]; vocabulary: VocabularyItem[]; sessions: StudySession[];
  seen: string[];
};

export const languages: Language[] = [
  { id: 'es', name: 'Spanish', locale: 'es-ES', availability: 'ready' },
  { id: 'pt', name: 'European Portuguese', locale: 'pt-PT', availability: 'coming' },
  { id: 'fr', name: 'French', locale: 'fr-FR', availability: 'coming' },
];

const q = (id: string, topic: string, format: Question['format'], prompt: string, accepted: string[], explanation: string, choices?: string[], word?: string, translation?: string, example?: string): Question => ({
  id, languageId: 'es', topic, format, prompt, accepted, explanation, choices,
  word: word || accepted[0], translation: translation || accepted[0], example: example || prompt,
});
export const questionBank: Question[] = [
  q('es-01','Greetings','multiple-choice','How do you say “Good morning” in Spanish?',['Buenos días'],'Use buenos días until around midday.',['Buenas noches','Buenos días','Buenas tardes','Hasta luego'],'Buenos días','Good morning','Buenos días, señora.'),
  q('es-02','Greetings','translation','Translate: “Hello, how are you?”',['Hola, ¿cómo estás?','Hola, como estas','Hola, ¿cómo está?'],'Hola is hello; ¿cómo estás? is the informal way to ask how someone is.',undefined,'Hola, ¿cómo estás?','Hello, how are you?','Hola, ¿cómo estás?'),
  q('es-03','Greetings','multiple-choice','Which phrase means “Good evening / good night”?',['Buenas noches'],'Buenas noches works as both an evening greeting and a farewell.',['Buenas tardes','Buenos días','Buenas noches','Buen viaje'],'Buenas noches','Good evening / good night','Buenas noches, hasta mañana.'),
  q('es-04','Greetings','free-text','Write “Thank you very much” in Spanish.',['Muchas gracias','Muchísimas gracias'],'Muchas gracias is the everyday expression for thank you very much.',undefined,'Muchas gracias','Thank you very much','Muchas gracias por venir.'),
  q('es-05','Greetings','multiple-choice','Choose the natural reply to “¿Cómo estás?”',['Estoy bien, gracias'],'Estoy bien, gracias means “I’m well, thank you.”',['Me llamo bien','Estoy bien, gracias','Tengo bien','Soy bien'],'Estoy bien, gracias','I am well, thank you','Estoy bien, gracias.'),
  q('es-06','Common verbs','grammar','Complete: Yo ___ español. (hablar)',['hablo'],'For regular -ar verbs, the yo form ends in -o: hablar → hablo.',['hablas','hablo','habla','hablamos'],'hablar','to speak','Yo hablo español.'),
  q('es-07','Common verbs','multiple-choice','What does “comemos” mean?',['we eat','we are eating'],'Comer becomes comemos with nosotros/nosotras.',['I eat','you eat','we eat','they eat'],'comer','to eat','Comemos juntos.'),
  q('es-08','Common verbs','translation','Translate: “She lives in Madrid.”',['Ella vive en Madrid','Vive en Madrid'],'Vivir is a regular -ir verb; ella vive. The subject pronoun may be omitted when clear.',undefined,'Ella vive en Madrid','She lives in Madrid.','Ella vive en Madrid.'),
  q('es-09','Common verbs','grammar','Choose the correct form: Tú ___ agua. (beber)',['bebes'],'The tú form of a regular -er verb ends in -es: beber → bebes.',['bebo','bebes','bebe','bebemos'],'beber','to drink','Tú bebes agua.'),
  q('es-10','Common verbs','free-text','Write “I have a book” in Spanish.',['Tengo un libro','Yo tengo un libro'],'Tener means “to have”; tengo is its first-person singular form.',undefined,'Tengo un libro','I have a book.','Tengo un libro.'),
  q('es-11','Articles & gender','multiple-choice','Which article belongs with “casa”?',['la casa'],'Casa is feminine, so it takes the article la.',['el casa','la casa','los casa','un casa'],'la casa','the house','La casa es grande.'),
  q('es-12','Articles & gender','grammar','Complete: ___ libro es nuevo.',['El','el'],'Libro is masculine singular, so use el.',['La','El','Los','Una'],'el libro','the book','El libro es nuevo.'),
  q('es-13','Articles & gender','multiple-choice','What is the plural of “un amigo”?',['unos amigos'],'The plural masculine article unos pairs with amigos.',['una amigas','unos amigos','el amigos','unas amigo'],'unos amigos','some friends','Tengo unos amigos.'),
  q('es-14','Articles & gender','grammar','Choose the correct phrase for “a red table.”',['una mesa roja'],'Mesa is feminine, so both the indefinite article and adjective take feminine form.',['un mesa rojo','una mesa roja','una mesa rojo','el mesa roja'],'una mesa roja','a red table','Una mesa roja.'),
  q('es-15','Articles & gender','translation','Translate: “The flowers are beautiful.”',['Las flores son bonitas','Las flores son hermosas'],'Flores is feminine plural; las and bonitas agree.',undefined,'Las flores son bonitas','The flowers are beautiful.','Las flores son bonitas.'),
  q('es-16','Everyday nouns','multiple-choice','“La ventana” means…',['the window'],'Ventana is a feminine noun meaning window.',['the door','the window','the street','the chair'],'la ventana','the window','Abre la ventana, por favor.'),
  q('es-17','Everyday nouns','translation','Translate: “Where is the bathroom?”',['¿Dónde está el baño?','Donde esta el baño','¿Dónde está el servicio?'],'¿Dónde está…? asks where something is; baño is the usual word for bathroom.',undefined,'¿Dónde está el baño?','Where is the bathroom?','¿Dónde está el baño?'),
  q('es-18','Everyday nouns','free-text','Write “water” in Spanish.',['agua'],'Agua is feminine, but singular uses el agua to avoid two adjacent a sounds.',undefined,'agua','water','El agua está fría.'),
  q('es-19','Everyday nouns','multiple-choice','What does “la comida” mean?',['the food','the meal'],'Comida can mean food or a meal, depending on context.',['the drink','the food','the kitchen','the market'],'la comida','food; a meal','La comida está lista.'),
  q('es-20','Everyday nouns','grammar','Complete: Tengo ___ manzana. (an apple)',['una'],'Manzana is feminine singular, so use una.',['un','una','unos','el'],'una manzana','an apple','Quiero una manzana.'),
  q('es-21','Simple phrases','multiple-choice','How do you say “Please”?',['por favor'],'Por favor is the standard polite expression.',['de nada','por favor','perdón','buen provecho'],'por favor','please','Un café, por favor.'),
  q('es-22','Simple phrases','translation','Translate: “I would like a coffee, please.”',['Quisiera un café, por favor','Me gustaría un café, por favor','Quiero un café, por favor'],'Quisiera is a polite way to order; me gustaría is another natural option.',undefined,'Quisiera un café, por favor','I would like a coffee, please.','Quisiera un café, por favor.'),
  q('es-23','Simple phrases','multiple-choice','What does “No entiendo” mean?',['I do not understand'],'Entender means to understand; no makes it negative.',['I do not know','I do not understand','I do not speak','I am not here'],'No entiendo','I do not understand','Lo siento, no entiendo.'),
  q('es-24','Simple phrases','free-text','Write “See you tomorrow” in Spanish.',['Hasta mañana'],'Hasta mañana is a common way to say goodbye until tomorrow.',undefined,'Hasta mañana','See you tomorrow.','Hasta mañana.'),
  q('es-25','Simple phrases','grammar','Complete: ¿___ llamas? (What is your name?)',['Cómo te','Como te'],'The phrase is ¿Cómo te llamas?; cómo carries an accent in a question.',['Dónde te','Cómo te','Qué tú','Quién te'],'llamarse','to be called','¿Cómo te llamas?'),
  q('es-26','Greetings','translation','Translate: “My name is Ana.”',['Me llamo Ana','Mi nombre es Ana'],'Me llamo is the common way to introduce your name; mi nombre es is also correct.',undefined,'Me llamo Ana','My name is Ana.','Me llamo Ana.'),
  q('es-27','Common verbs','multiple-choice','Choose the meaning of “quiero”.',['I want'],'Querer is an irregular verb; quiero means I want.',['I can','I want','I go','I see'],'querer','to want','Quiero aprender español.'),
  q('es-28','Common verbs','grammar','Complete: Nosotros ___ una película. (ver)',['vemos'],'Ver is irregular only in some forms; nosotros vemos is regular.',['veo','ves','vemos','ven'],'ver','to see','Vemos una película.'),
  q('es-29','Everyday nouns','translation','Translate: “I need a ticket.”',['Necesito un billete','Necesito un boleto'],'Billete is common in Spain; boleto is used in much of Latin America.',undefined,'un billete','a ticket','Necesito un billete.'),
  q('es-30','Simple phrases','multiple-choice','Which means “I don’t know”?',['No lo sé'],'No lo sé is the usual phrase; lo refers to the thing you do not know.',['No puedo','No lo sé','No entiendo','No tengo'],'No lo sé','I do not know','No lo sé, lo siento.'),
];

export const contentRegistry: ContentRegistry = Object.fromEntries(
  languages.map(language => [
    language.id,
    {
      language,
      questions: questionBank.filter(question => question.languageId === language.id),
    },
  ]),
);

export const validateContentRegistry = (registry: Readonly<ContentRegistry> = contentRegistry): string[] => {
  const errors: string[] = [];
  const supportedLanguageIds = new Set(languages.map(language => language.id));
  const questionIds = new Set<string>();

  for (const language of languages) {
    if (!Object.hasOwn(registry, language.id)) {
      errors.push(`Missing content registry entry for supported language "${language.id}".`);
    }
  }

  for (const [languageId, bank] of Object.entries(registry)) {
    if (!supportedLanguageIds.has(languageId)) {
      errors.push(`Unsupported language ID "${languageId}" in content registry.`);
    }
    if (!bank || typeof bank !== 'object') {
      errors.push(`Content registry entry "${languageId}" is invalid.`);
      continue;
    }
    if (!supportedLanguageIds.has(bank.language.id)) {
      errors.push(`Unsupported language ID "${bank.language.id}" in registry metadata.`);
    } else if (bank.language.id !== languageId) {
      errors.push(`Registry key "${languageId}" does not match metadata ID "${bank.language.id}".`);
    }

    for (const question of bank.questions) {
      if (!supportedLanguageIds.has(question.languageId)) {
        errors.push(`Question "${question.id}" uses unsupported language ID "${question.languageId}".`);
      } else if (question.languageId !== languageId) {
        errors.push(`Question "${question.id}" belongs to "${question.languageId}" but is listed under "${languageId}".`);
      }
      if (questionIds.has(question.id)) {
        errors.push(`Duplicate question ID "${question.id}" in content registry.`);
      } else {
        questionIds.add(question.id);
      }
    }
  }

  return errors;
};

const contentRegistryErrors = validateContentRegistry();
if (contentRegistryErrors.length) {
  throw new Error(`Invalid language content registry:\n${contentRegistryErrors.join('\n')}`);
}

export const createInitialState = (): LinguaState => ({
  version: 1, languageId: 'es', dailyGoal: 10, attempts: [], history: {}, streak: 0, lastPracticeDay: null,
  reviews: [], mistakes: [], vocabulary: [], sessions: [], seen: [],
});
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const normalizeAnswer = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:'"“”]/g,'').replace(/\s+/g,' ').trim();
export const isCorrectAnswer = (answer: string, accepted: string[]) => accepted.some(a => normalizeAnswer(answer) === normalizeAnswer(a));

export const calculatePracticeAccuracy = (attempts: Attempt[]): number | null =>
  attempts.length ? Math.round(attempts.filter(attempt => attempt.correct).length / attempts.length * 100) : null;

export const isReviewDue = (item: Pick<ReviewItem, 'dueAt'>, now: Date | number = Date.now()): boolean => {
  const dueAt = Date.parse(item.dueAt);
  const currentTime = now instanceof Date ? now.getTime() : now;
  return Number.isFinite(dueAt) && dueAt <= currentTime;
};

export const scheduleReviewAt = (from: string | Date, intervalDays: number): string => {
  const timestamp = from instanceof Date ? from.getTime() : Date.parse(from);
  return new Date(timestamp + Math.max(0, intervalDays) * 24 * 60 * 60 * 1000).toISOString();
};

export const upsertMistake = (
  mistakes: MistakeItem[],
  question: Question,
  userAnswer: string,
  missedAt: string,
  nextReviewAt: string,
): MistakeItem[] => {
  const previous = mistakes.find(item => item.questionId === question.id);
  const originalQuestion = {
    ...question,
    accepted: [...question.accepted],
    choices: question.choices ? [...question.choices] : undefined,
  };
  const next: MistakeItem = {
    questionId: question.id,
    originalQuestion,
    userAnswer,
    correctAnswer: question.accepted[0],
    explanation: question.explanation,
    firstMissedAt: previous?.firstMissedAt || missedAt,
    lastMissedAt: missedAt,
    nextReviewAt,
    timesMissed: (previous?.timesMissed || 0) + 1,
  };
  return [...mistakes.filter(item => item.questionId !== question.id), next];
};

export const migrateReviewSources = (reviews: ReviewItem[], attempts: Attempt[]): ReviewItem[] =>
  reviews.map(review => ({
    ...review,
    source: review.source === 'mistake' || review.source === 'practice' ? review.source : (
      attempts.some(attempt => attempt.questionId === review.questionId && !attempt.correct)
        ? 'mistake'
        : 'practice'
    ),
  }));

export const migrateLegacyMistakes = (attempts: Attempt[], reviews: ReviewItem[]): MistakeItem[] => {
  const missedByQuestion = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (attempt.correct) continue;
    const missed = missedByQuestion.get(attempt.questionId) || [];
    missed.push(attempt);
    missedByQuestion.set(attempt.questionId, missed);
  }

  return [...missedByQuestion.entries()].flatMap(([questionId, missed]) => {
    const question = questionBank.find(item => item.id === questionId);
    if (!question) return [];
    const first = missed[0];
    const latest = missed[missed.length - 1];
    const scheduledReview = reviews.find(item => item.questionId === questionId);
    return [{
      questionId,
      originalQuestion: {
        ...question,
        accepted: [...question.accepted],
        choices: question.choices ? [...question.choices] : undefined,
      },
      userAnswer: latest.answer,
      correctAnswer: question.accepted[0],
      explanation: question.explanation,
      firstMissedAt: first.timestamp,
      lastMissedAt: latest.timestamp,
      nextReviewAt: scheduledReview?.dueAt || scheduleReviewAt(latest.timestamp, 1),
      timesMissed: missed.length,
    }];
  });
};

export const isMistakeItem = (value: unknown): value is MistakeItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MistakeItem>;
  const question = item.originalQuestion as Partial<Question> | undefined;
  return typeof item.questionId === 'string'
    && typeof item.userAnswer === 'string'
    && typeof item.correctAnswer === 'string'
    && typeof item.explanation === 'string'
    && typeof item.firstMissedAt === 'string'
    && typeof item.lastMissedAt === 'string'
    && typeof item.nextReviewAt === 'string'
    && typeof item.timesMissed === 'number'
    && Boolean(question && typeof question.prompt === 'string' && Array.isArray(question.accepted));
};
