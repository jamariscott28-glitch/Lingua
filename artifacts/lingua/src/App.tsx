import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { BookOpen, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Flame, Leaf, Library, ListChecks, RotateCcw, Settings2, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { createInitialState, dayKey, isCorrectAnswer, languages, normalizeAnswer, questionBank, type Attempt, type LinguaState, type Question } from './learning';

const STORAGE_KEY = 'lingua-learning-v1';
const navigation = [
  { href: '/', label: 'Today', icon: Leaf },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  { href: '/review', label: 'Notebook', icon: Bookmark },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/languages', label: 'Languages', icon: Library },
];
const spanishQuestions = questionBank.filter(q => q.languageId === 'es');
const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
const dayName = (date: Date) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);

function readSaved(): { state: LinguaState; malformed: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: createInitialState(), malformed: false };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.dailyGoal !== 'number' || !Array.isArray(parsed.attempts) || !Array.isArray(parsed.reviews) || !Array.isArray(parsed.vocabulary) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.seen)) throw new Error('Invalid saved learning state');
    if (!parsed.history || typeof parsed.history !== 'object' || Array.isArray(parsed.history) || !Number.isFinite(parsed.streak) || ![5, 10, 15, 20].includes(parsed.dailyGoal)) throw new Error('Invalid saved learning state');
    if (parsed.attempts.some((item: Attempt) => !item || typeof item.questionId !== 'string' || typeof item.timestamp !== 'string' || typeof item.correct !== 'boolean' || typeof item.answer !== 'string')) throw new Error('Invalid saved attempts');
    if (parsed.reviews.some((item: LinguaState['reviews'][number]) => !item || typeof item.questionId !== 'string' || typeof item.dueAt !== 'string' || typeof item.interval !== 'number' || typeof item.ease !== 'number')) throw new Error('Invalid saved reviews');
    if (parsed.vocabulary.some((item: LinguaState['vocabulary'][number]) => !item || typeof item.word !== 'string' || typeof item.translation !== 'string' || typeof item.example !== 'string' || typeof item.languageId !== 'string')) throw new Error('Invalid saved vocabulary');
    if (parsed.sessions.some((item: LinguaState['sessions'][number]) => !item || typeof item.startedAt !== 'string' || typeof item.answered !== 'number' || typeof item.correct !== 'number')) throw new Error('Invalid saved sessions');
    const allowed = languages.some(language => language.id === parsed.languageId);
    return { state: { ...createInitialState(), ...parsed, languageId: allowed ? parsed.languageId : 'es' }, malformed: false };
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    return { state: createInitialState(), malformed: true };
  }
}

function App() {
  const [location, setLocation] = useLocation();
  const [initialRead] = useState(() => readSaved());
  const [state, setState] = useState<LinguaState>(initialRead.state);
  const [storageNotice, setStorageNotice] = useState(() => initialRead.malformed ? 'A damaged local learning file was cleared. Your new practice starts here.' : '');
  const [toast, setToast] = useState('');
  const [activeSession, setActiveSession] = useState<{ ids: string[]; index: number; startedAt: string } | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewReveal, setReviewReveal] = useState(false);
  const [vocabReveal, setVocabReveal] = useState<string[]>([]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { setStorageNotice('Your browser could not save this session. Check available device storage.'); }
  }, [state]);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const language = languages.find(item => item.id === state.languageId) || languages[0];
  const availableQuestions = questionBank.filter(q => q.languageId === state.languageId);
  const todaysAttempts = state.attempts.filter(a => dayKey(new Date(a.timestamp)) === dayKey());
  const accuracy = state.attempts.length ? Math.round(state.attempts.filter(a => a.correct).length / state.attempts.length * 100) : 0;
  const dueReviewItems = state.reviews.filter(item => item.dueAt <= new Date().toISOString() && item.questionId.startsWith(`${state.languageId}-`));
  const dueReviewQuestions = dueReviewItems.map(item => availableQuestions.find(q => q.id === item.questionId)).filter((item): item is Question => Boolean(item));
  const reviewQuestion = dueReviewQuestions[reviewIndex % Math.max(1, dueReviewQuestions.length)];
  const savedVocabulary = state.vocabulary.filter(item => item.languageId === state.languageId);
  const latestAttempts = [...state.attempts].reverse().slice(0, 8);
  const sessionQuestion = activeSession ? availableQuestions.find(q => q.id === activeSession.ids[activeSession.index]) : undefined;
  const setGoal = (goal: number) => setState(previous => ({ ...previous, dailyGoal: goal }));

  const showToast = (message: string) => setToast(message);
  const startSession = () => {
    const due = state.reviews.filter(item => item.dueAt <= new Date().toISOString() && item.questionId.startsWith(`${state.languageId}-`)).map(item => item.questionId);
    const unseen = availableQuestions.filter(q => !state.seen.includes(q.id) && !due.includes(q.id)).map(q => q.id);
    const remaining = availableQuestions.filter(q => !due.includes(q.id) && !unseen.includes(q.id)).map(q => q.id);
    const ordered = [...new Set([...due, ...unseen, ...remaining])];
    if (!ordered.length) { showToast('No lessons are available for this language yet.'); return; }
    const ids = ordered.slice(0, Math.min(5, ordered.length));
    setActiveSession({ ids, index: 0, startedAt: new Date().toISOString() });
    setLocation('/learn');
  };
  const saveVocab = (question: Question) => {
    const exists = state.vocabulary.some(item => item.word === question.word && item.languageId === state.languageId);
    if (exists) { showToast('Already in your saved words.'); return; }
    setState(previous => ({ ...previous, vocabulary: [...previous.vocabulary, { word: question.word, translation: question.translation, example: question.example, languageId: state.languageId, savedAt: new Date().toISOString() }] }));
    showToast('Saved to your words.');
  };
  const recordAnswer = (question: Question, answer: string, correct: boolean) => {
    const attempt: Attempt = { questionId: question.id, timestamp: new Date().toISOString(), correct, answer };
    setState(previous => {
      const today = dayKey();
      const existingReview = previous.reviews.find(item => item.questionId === question.id);
      const nextReviews = correct
        ? existingReview
          ? [...previous.reviews.filter(item => item.questionId !== question.id), { questionId: question.id, dueAt: new Date(Date.now() + Math.max(2, existingReview.interval * 2) * 86400000).toISOString(), interval: Math.max(2, existingReview.interval * 2), ease: Math.min(3, existingReview.ease + .1), status: 'learning' as const }]
          : previous.reviews
        : [
          ...previous.reviews.filter(item => item.questionId !== question.id),
          { questionId: question.id, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), interval: 1, ease: 2.5, status: 'due' as const },
        ];
      return { ...previous, attempts: [...previous.attempts, attempt], history: { ...previous.history, [today]: (previous.history[today] || 0) + 1 }, reviews: nextReviews, seen: previous.seen.includes(question.id) ? previous.seen : [...previous.seen, question.id] };
    });
  };
  const finishSession = () => {
    if (!activeSession) return;
    setState(previous => {
      const attempts = previous.attempts.filter(item => item.timestamp >= activeSession.startedAt);
      const answered = attempts.length;
      const correct = attempts.filter(item => item.correct).length;
      const today = dayKey();
      const yesterday = dayKey(new Date(Date.now() - 86400000));
      const streak = previous.lastPracticeDay === today ? previous.streak : previous.lastPracticeDay === yesterday ? previous.streak + 1 : 1;
      const session = { startedAt: activeSession.startedAt, completedAt: new Date().toISOString(), answered, correct };
      return { ...previous, streak, lastPracticeDay: today, sessions: [...previous.sessions, session] };
    });
    setActiveSession(null);
    showToast('Practice session saved. Lovely work.');
    setLocation('/');
  };
  const advanceSession = () => setActiveSession(previous => previous ? { ...previous, index: previous.index + 1 } : null);
  const rateReview = (remembered: boolean) => {
    const question = reviewQuestion;
    if (!question) return;
    setState(previous => {
      const old = previous.reviews.find(item => item.questionId === question.id);
      const interval = remembered ? Math.max(2, (old?.interval || 1) * 2) : 1;
      const dueAt = new Date(Date.now() + interval * 86400000).toISOString();
      return { ...previous, reviews: [...previous.reviews.filter(item => item.questionId !== question.id), { questionId: question.id, dueAt, interval, ease: remembered ? Math.min(3, (old?.ease || 2.5) + .1) : Math.max(1.3, (old?.ease || 2.5) - .2), status: remembered ? 'learning' as const : 'due' as const }] };
    });
    setReviewReveal(false);
    setReviewIndex(0);
    showToast(remembered ? 'Nice recall. We’ll give this one more space.' : 'No problem. We’ll bring this back tomorrow.');
  };
  const removeVocab = (word: string) => setState(previous => ({ ...previous, vocabulary: previous.vocabulary.filter(item => !(item.word === word && item.languageId === state.languageId)) }));
  const switchLanguage = (id: string) => {
    const target = languages.find(item => item.id === id);
    if (!target) return;
    setState(previous => ({ ...previous, languageId: id }));
    setActiveSession(null);
    showToast(target.availability === 'ready' ? `${target.name} selected.` : `${target.name} selected. Lessons are coming soon.`);
  };
  const abandonSession = () => { setActiveSession(null); setLocation('/'); };
  const dailyProgress = Math.min(100, Math.round(todaysAttempts.length / state.dailyGoal * 100));

  return <div className="app-shell">
    <aside className="desktop-nav">
      <Link href="/" className="brand"><span className="brand-mark"><Leaf size={20} /></span>lingua</Link>
      <nav className="desktop-links" aria-label="Main navigation">
        {navigation.map(item => <Link key={item.href} href={item.href} className={`desktop-link ${location === item.href ? 'active' : ''}`}><item.icon size={18} />{item.label}</Link>)}
      </nav>
      <div className="desktop-bottom">A small practice, every day.<br />Your learning stays on this device.</div>
    </aside>
    <header className="topbar">
      <Link href="/" className="brand"><span className="brand-mark"><Leaf size={18} /></span>lingua</Link>
      <Link href="/languages" className="btn btn-outline btn-small"><span>{language.name}</span><ChevronRight size={14} /></Link>
    </header>
    {storageNotice && <div className="page"><div className="notice" role="status">{storageNotice}<button className="mini-action" aria-label="Dismiss notice" onClick={() => setStorageNotice('')}><X size={15}/></button></div></div>}
    <Switch>
      <Route path="/learn">
        <LearnPage language={language} session={activeSession} question={sessionQuestion} onStart={startSession} onExit={abandonSession} onAnswer={recordAnswer} onFinish={finishSession} onAdvance={advanceSession} onSave={saveVocab} />
      </Route>
      <Route path="/review">
        <ReviewPage due={dueReviewQuestions} upcoming={state.reviews.filter(item => item.dueAt > new Date().toISOString() && item.questionId.startsWith(`${state.languageId}-`)).map(item => availableQuestions.find(q => q.id === item.questionId)).filter((item): item is Question => Boolean(item))} dueCount={dueReviewItems.length} question={reviewQuestion} reveal={reviewReveal} setReveal={setReviewReveal} vocabulary={savedVocabulary} vocabReveal={vocabReveal} setVocabReveal={setVocabReveal} onRemove={removeVocab} onRate={rateReview} />
      </Route>
      <Route path="/progress">
        <ProgressPage state={state} accuracy={accuracy} todaysAttempts={todaysAttempts.length} />
      </Route>
      <Route path="/languages">
        <LanguagesPage selected={state.languageId} onSelect={switchLanguage} />
      </Route>
      <Route path="/">
        <HomePage state={state} language={language} attemptsToday={todaysAttempts.length} dailyProgress={dailyProgress} dueCount={dueReviewItems.length} onGoal={setGoal} onStart={startSession} />
      </Route>
      <Route>
        <HomePage state={state} language={language} attemptsToday={todaysAttempts.length} dailyProgress={dailyProgress} dueCount={dueReviewItems.length} onGoal={setGoal} onStart={startSession} />
      </Route>
    </Switch>
    <nav className="bottom-nav" aria-label="Main navigation">
      {navigation.map(item => <Link key={item.href} href={item.href} className={`nav-item ${location === item.href ? 'active' : ''}`}><item.icon size={19} strokeWidth={1.8}/><span>{item.label}</span></Link>)}
    </nav>
    {toast && <div className="toast-note" role="status">{toast}</div>}
  </div>;
}

function HomePage({ state, language, attemptsToday, dailyProgress, dueCount, onGoal, onStart }: { state: LinguaState; language: typeof languages[number]; attemptsToday: number; dailyProgress: number; dueCount: number; onGoal: (goal: number) => void; onStart: () => void }) {
  const goalMet = attemptsToday >= state.dailyGoal;
  return <main className="page">
    <div className="eyebrow">{dateLabel}</div>
    <section className="hero-card" style={{ marginTop: 16 }}>
      <div className="eyebrow">A little {language.name.toLowerCase()} goes a long way</div>
      <h1>{goalMet ? 'You showed up for yourself.' : 'Make room for a new word.'}</h1>
      <p>{goalMet ? 'Today’s practice is complete. Take a moment to enjoy the progress.' : 'A few thoughtful minutes today can make tomorrow feel more familiar.'}</p>
      <div className="hero-actions"><button className="btn btn-primary" onClick={onStart}>{goalMet ? 'Keep learning' : 'Start learning'}<ChevronRight size={17}/></button></div>
    </section>
    <div className="section-head"><h2>Your rhythm</h2><span className="eyebrow">JUST FOR YOU</span></div>
    <section className="metrics">
      <div className="metric"><span className="metric-label"><Target size={15}/> Daily goal</span><strong>{attemptsToday}<small> / {state.dailyGoal}</small></strong><small>answers today</small></div>
      <div className="metric"><span className="metric-label"><Flame size={15}/> Current streak</span><strong>{state.streak}<small> days</small></strong><small>one completed session a day</small></div>
      <div className="metric"><span className="metric-label"><TrendingUp size={15}/> Practice accuracy</span><strong>{state.attempts.length ? `${Math.round(state.attempts.filter(a => a.correct).length / state.attempts.length * 100)}%` : '—'}</strong><small>across all answers</small></div>
      <div className="metric"><span className="metric-label"><RotateCcw size={15}/> Ready to revisit</span><strong>{dueCount}</strong><small>in your notebook</small></div>
    </section>
    <div className="section-head"><h2>Today’s intention</h2><span className="eyebrow">AIM FOR WHAT FITS</span></div>
    <section className="progress-card">
      <div className="progress-top"><span>Daily practice</span><strong>{Math.min(attemptsToday, state.dailyGoal)} of {state.dailyGoal} answers</strong></div>
      <div className="track"><span style={{ width: `${dailyProgress}%` }}/></div>
      <div className="progress-top"><span>{goalMet ? 'You made it today.' : 'Small steps count.'}</span><div className="goal-row"><label htmlFor="goal" className="subtle" style={{fontSize:11}}>Goal</label><select id="goal" className="goal-select" value={state.dailyGoal} onChange={event => onGoal(Number(event.target.value))}>{[5,10,15,20].map(goal => <option key={goal} value={goal}>{goal} answers</option>)}</select></div></div>
    </section>
    <div className="section-head"><h2>Pick up where you are</h2></div>
    <div className="quick-row">
      <button className="quick-card" onClick={onStart}><BookOpen size={19}/><span>Continue a lesson</span></button>
      <Link href="/review" className="quick-card"><Bookmark size={19}/><span>Visit your notebook</span></Link>
      <Link href="/progress" className="quick-card"><CalendarDays size={19}/><span>See your progress</span></Link>
    </div>
    <div className="notice" style={{marginTop:20}}>Your practice accuracy reflects answers in Lingua. It is not a CEFR assessment or a measure of speaking ability.</div>
  </main>;
}

function LearnPage({ language, session, question, onStart, onExit, onAnswer, onFinish, onAdvance, onSave }: { language: typeof languages[number]; session: { ids: string[]; index: number; startedAt: string } | null; question: Question | undefined; onStart: () => void; onExit: () => void; onAnswer: (question: Question, answer: string, correct: boolean) => void; onFinish: () => void; onAdvance: () => void; onSave: (question: Question) => void }) {
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  useEffect(() => { setSelected(''); setSubmitted(false); setAnswer(''); setFeedbackText(''); }, [session?.index, question?.id]);
  const submit = () => {
    if (!question || submitted) return;
    const value = question.choices ? selected : answer;
    if (!value.trim()) return;
    const correct = isCorrectAnswer(value, question.accepted);
    setFeedbackCorrect(correct);
    setFeedbackText(question.explanation);
    setSubmitted(true);
    onAnswer(question, value, correct);
  };
  if (language.availability !== 'ready') return <main className="lesson-wrap"><div className="panel empty-state"><div className="empty-icon"><BookOpen size={22}/></div><h3>Lessons are on their way</h3><p>{language.name} is in your language shelf, ready for a future course. For now, choose Spanish to practise.</p><Link className="btn btn-forest" href="/languages">Explore languages</Link></div></main>;
  if (!session) return <main className="lesson-wrap"><div className="eyebrow">YOUR SPANISH PRACTICE</div><h1 className="page-title">A few good questions.</h1><p className="subtle" style={{maxWidth:440}}>Practice with a gentle mix of new phrases and anything you found tricky before. No timer, no score pressure.</p><section className="panel" style={{marginTop:25}}><div style={{display:'flex',alignItems:'center',gap:14}}><div className="empty-icon" style={{margin:0}}><Sparkles size={21}/></div><div><strong style={{color:'#31513e'}}>A focused little session</strong><div className="subtle" style={{fontSize:12,marginTop:4}}>Up to 5 questions · about 3 minutes</div></div></div><button className="btn btn-forest" style={{marginTop:23,width:'100%'}} onClick={onStart}>Begin practice<ChevronRight size={16}/></button></section><div className="notice" style={{marginTop:18}}>Lessons work offline once this app has been opened on your device.</div></main>;
  if (!question) return <main className="lesson-wrap"><section className="complete-card"><Check size={28}/><h2>That’s a lovely start.</h2><p>You made time to practise. Your answers are saved on this device.</p><button className="btn btn-primary" onClick={onFinish}>Finish session</button></section></main>;
  return <main className="lesson-wrap">
    <div className="lesson-head"><button className="icon-button" aria-label="Leave lesson" onClick={onExit}><ChevronLeft size={20}/></button><div className="lesson-progress"><div className="progress-top"><span>Spanish practice</span><strong>{session.index + 1} of {session.ids.length}</strong></div><div className="track" style={{margin:'8px 0 0'}}><span style={{width:`${(session.index / session.ids.length) * 100}%`}}/></div></div><span className="eyebrow">{session.index + 1}/{session.ids.length}</span></div>
    <div className="question-card">
      <div className="question-meta"><span className="topic-pill">{question.topic}</span><button className="mini-action" aria-label="Save vocabulary item" onClick={() => onSave(question)}><Bookmark size={17}/></button></div>
      <h1 className="question-prompt">{question.prompt}</h1><p className="question-instruction">{question.choices ? 'Choose the best answer.' : 'Write your answer below.'}</p>
      {question.choices ? <div className="answer-list">{question.choices.map((choice,index) => {
        const isSelected = selected === choice;
        const correctOption = submitted && question.accepted.some(value => normalizeAnswer(value) === normalizeAnswer(choice));
        const wrongOption = submitted && isSelected && !feedbackCorrect;
        return <button key={choice} disabled={submitted} className={`answer-option ${isSelected ? 'selected' : ''} ${correctOption ? 'correct' : ''} ${wrongOption ? 'wrong' : ''}`} onClick={() => setSelected(choice)}><span className="choice-letter">{String.fromCharCode(65+index)}</span>{choice}{correctOption && submitted && <Check size={17} style={{marginLeft:'auto'}}/>}</button>;
      })}</div> : <input aria-label="Your answer" className="text-answer" value={answer} disabled={submitted} onChange={event => setAnswer(event.target.value)} onKeyDown={event => { if(event.key === 'Enter') submit(); }} placeholder="Type your answer…" />}
      {submitted && <div className={`feedback ${feedbackCorrect ? 'good' : 'bad'}`} role="status"><strong>{feedbackCorrect ? 'That’s right.' : 'Not quite — keep it with you.'}</strong>{feedbackText}{!feedbackCorrect && <div style={{marginTop:6}}><b>Answer:</b> {question.accepted[0]}</div>}</div>}
      <div className="lesson-controls">{!submitted ? <button className="btn btn-forest" onClick={submit} disabled={!(question.choices ? selected : answer.trim())}>Check answer<Check size={16}/></button> : <button className="btn btn-forest" onClick={() => session.index + 1 >= session.ids.length ? onFinish() : onAdvance()}>Continue<ChevronRight size={16}/></button>}</div>
    </div>
  </main>;
}

function ReviewPage({ due, upcoming, dueCount, question, reveal, setReveal, onRate, vocabulary, vocabReveal, setVocabReveal, onRemove }: { due: Question[]; upcoming: Question[]; dueCount: number; question?: Question; reveal: boolean; setReveal: (value: boolean) => void; onRate: (remembered: boolean) => void; vocabulary: LinguaState['vocabulary']; vocabReveal: string[]; setVocabReveal: (words: string[]) => void; onRemove: (word: string) => void }) {
  return <main className="page">
    <div className="eyebrow">A FRIENDLY PLACE TO RETURN</div><h1 className="page-title">Your notebook.</h1><p className="subtle">The phrases that need another moment, and the words you chose to keep.</p>
    <div className="section-head"><h2>Ready to revisit</h2><span className="review-count">{dueCount} due</span></div>
    {question ? <section className="review-card">
      <div className="question-meta"><span className="topic-pill">{question.topic}</span><span className="review-count">A gentle second look</span></div>
      <div className="review-word">{question.prompt.replace(/^Translate:\s*/,'')}</div>
      {reveal ? <><div className="review-answer">{question.accepted[0]}</div><div className="notice">{question.explanation}</div><div className="review-actions"><button className="btn btn-outline btn-small" onClick={() => onRate(false)}>Again tomorrow</button><button className="btn btn-forest btn-small" onClick={() => onRate(true)}>I remembered it<Check size={14}/></button></div></> : <button className="btn btn-forest btn-small" onClick={() => setReveal(true)}>Show answer<ChevronRight size={14}/></button>}
      <div className="review-count" style={{marginTop:12}}>{due.length} item{due.length === 1 ? '' : 's'} in today’s queue</div>
    </section> : <section className="panel empty-state"><div className="empty-icon"><Check size={21}/></div><h3>All clear for today</h3><p>Your review queue is quiet. Missed questions will return here when they’re ready.</p><Link className="btn btn-quiet btn-small" href="/learn">Start a lesson</Link></section>}
    {upcoming.length > 0 && <><div className="section-head"><h2>On the horizon</h2><span className="review-count">{upcoming.length} scheduled</span></div><section className="panel">{upcoming.map(item => <div className="item-row" key={item.id}><div><div className="word-main" style={{fontSize:16}}>{item.accepted[0]}</div><div className="word-sub">{item.topic} · returns tomorrow or later</div></div><RotateCcw size={15} color="#899286"/></div>)}</section></>}
    <div className="section-head"><h2>Saved vocabulary</h2><span className="review-count">{vocabulary.length} saved</span></div>
    <section className="panel">
      {vocabulary.length ? vocabulary.map(item => {
        const open = vocabReveal.includes(item.word);
        return <div className="item-row" key={item.word}><div><div className="word-main">{item.word}</div>{open ? <><div className="word-sub">{item.translation}</div><div className="word-sub"><i>{item.example}</i></div></> : <div className="word-sub">Tap the card to recall its meaning</div>}<button className="text-link" onClick={() => setVocabReveal(open ? vocabReveal.filter(word => word !== item.word) : [...vocabReveal,item.word])}>{open ? 'Hide meaning' : 'Reveal meaning'}</button></div><div className="row-actions"><button className="mini-action" aria-label={`Remove ${item.word}`} onClick={() => onRemove(item.word)}><X size={16}/></button></div></div>;
      }) : <div className="empty-state"><div className="empty-icon"><Bookmark size={20}/></div><h3>Keep a word close</h3><p>Tap the bookmark beside any lesson prompt to save a word here for later.</p></div>}
    </section>
    <div className="notice">Review spacing is simple by design: a missed word comes back tomorrow; remembered words return after a longer interval.</div>
  </main>;
}

function ProgressPage({ state, accuracy, todaysAttempts }: { state: LinguaState; accuracy: number; todaysAttempts: number }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = dayKey(date); return { key, label: dayName(date), value: state.history[key] || 0, today: index === 6 }; }), [state.history]);
  const totalAnswers = state.attempts.length;
  return <main className="page">
    <div className="eyebrow">A RECORD OF YOUR PRACTICE</div><h1 className="page-title">Look how far you’ve come.</h1><p className="subtle">Small, steady effort adds up. These numbers are a mirror of your practice, not a language-level assessment.</p>
    <section className="stat-grid" style={{marginTop:24}}>
      <div className="stat-box"><span>Questions answered</span><strong>{totalAnswers}</strong></div>
      <div className="stat-box"><span>Practice accuracy</span><strong>{totalAnswers ? `${accuracy}%` : '—'}</strong></div>
      <div className="stat-box"><span>Study sessions</span><strong>{state.sessions.length}</strong></div>
      <div className="stat-box"><span>Current streak</span><strong>{state.streak} days</strong></div>
    </section>
    <div className="section-head"><h2>Practice over time</h2><span className="eyebrow">LAST 7 DAYS</span></div>
    <section className="panel">
      {totalAnswers ? <><div className="chart" aria-label="Answers per day over the past week">{days.map(day => <div className="chart-col" key={day.key}><span className="review-count">{day.value || ''}</span><div className={`chart-bar ${day.today ? 'today' : ''}`} style={{height:`${Math.max(5, day.value / Math.max(1,...days.map(d=>d.value))*100)}%`}}/><span className="chart-label">{day.label}</span></div>)}</div><div className="subtle" style={{fontSize:11,marginTop:12}}>Answers each day · {todaysAttempts} today</div></> : <div className="empty-state"><div className="empty-icon"><CalendarDays size={20}/></div><h3>Your first week starts here</h3><p>After a little practice, this chart will show your daily rhythm.</p><Link href="/learn" className="btn btn-forest btn-small">Begin a lesson</Link></div>}
    </section>
    <div className="section-head"><h2>Recent answers</h2><Link href="/review" className="text-link">Notebook</Link></div>
    <section className="panel">
      {state.attempts.length ? [...state.attempts].reverse().slice(0,6).map((attempt,index) => {
        const question = questionBank.find(item => item.id === attempt.questionId);
        return <div className="item-row" key={`${attempt.timestamp}-${index}`}><div><div className="word-main" style={{fontSize:15}}>{question?.topic || 'Practice'}</div><div className="word-sub">{question?.prompt || attempt.questionId}</div></div><span style={{color:attempt.correct ? '#4f8057' : '#984b52'}}>{attempt.correct ? 'Correct' : 'Review'}</span></div>;
      }) : <div className="empty-state"><div className="empty-icon"><ListChecks size={20}/></div><h3>No answers yet</h3><p>Start your first lesson and your practice history will appear here.</p></div>}
    </section>
    <div className="notice"><CircleHelp size={14} style={{verticalAlign:'middle',marginRight:5}}/> Lingua records practice accuracy only. It does not infer proficiency, assess CEFR level, or evaluate speaking.</div>
  </main>;
}

function LanguagesPage({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return <main className="page">
    <div className="eyebrow">YOUR PERSONAL LANGUAGE SHELF</div><h1 className="page-title">Choose your next language.</h1><p className="subtle" style={{maxWidth:460}}>One good place to keep the languages you’re curious about. Your learning progress stays saved on this device.</p>
    <div className="section-head"><h2>Available to you</h2></div>
    <section className="language-list">{languages.map(language => <button key={language.id} className={`language-tile ${selected === language.id ? 'selected' : ''}`} onClick={() => onSelect(language.id)}><span className="language-initial">{language.id === 'pt' ? 'P' : language.id.toUpperCase()}</span><span style={{textAlign:'left'}}><strong>{language.name}</strong><small>{language.locale}</small></span><span className="language-tag">{language.availability === 'ready' ? 'LESSONS READY' : 'COMING SOON'}</span>{selected === language.id && <Check size={17}/>}</button>)}</section>
    <div className="notice" style={{marginTop:18}}>Spanish is the only lesson bank available right now. Other languages can be selected and remembered here, but do not yet have lessons.</div>
    <div className="panel" style={{marginTop:20}}><div style={{display:'flex',gap:13,alignItems:'flex-start'}}><Settings2 size={18} color="#527152"/><div><strong style={{fontSize:13,color:'#31513e'}}>Made for a small daily ritual</strong><p className="subtle" style={{fontSize:12,margin:'6px 0 0'}}>No account, no streak pressure, no course treadmill. Your words and practice history belong to this browser.</p></div></div></div>
  </main>;
}

export default App;
