// ══════════════════════════════════════════════════════════
//  CONSTANTES — Courbe d'Ebbinghaus
//  J+1 → J+3 → J+7 → J+14 → J+28 → puis +28 à l'infini
// ══════════════════════════════════════════════════════════
 
const INTERVALS = [1, 3, 7, 14, 28];
 
/**
 * Retourne le nombre de jours avant la prochaine révision
 * selon l'étape actuelle (stage).
 * Stage 0 → premier rappel dans INTERVALS[0] jours, etc.
 * Au-delà du tableau, on ajoute 28 jours supplémentaires à chaque fois.
 */
function nextInterval(stage) {
  if (stage < INTERVALS.length) return INTERVALS[stage];
  return 28 * (stage - INTERVALS.length + 2);
}
 
// ══════════════════════════════════════════════════════════
//  UTILITAIRES — Dates
// ══════════════════════════════════════════════════════════
 
/** Retourne la date du jour au format YYYY-MM-DD */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
 
/** Ajoute n jours à une date YYYY-MM-DD */
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
 
/** Retourne le nombre de jours entre aujourd'hui et dateStr (positif = futur) */
function daysDiff(dateStr) {
  const d1 = new Date(today() + 'T00:00:00');
  const d2 = new Date(dateStr + 'T00:00:00');
  return Math.round((d2 - d1) / 86_400_000);
}
 
// ══════════════════════════════════════════════════════════
//  PERSISTANCE — localStorage
// ══════════════════════════════════════════════════════════
 
function loadCards() {
  try { return JSON.parse(localStorage.getItem('memoriaCards') || '[]'); }
  catch { return []; }
}
 
function saveCards(cards) {
  localStorage.setItem('memoriaCards', JSON.stringify(cards));
}
 
/**
 * Crée une nouvelle fiche avec les valeurs par défaut.
 * La fiche est due immédiatement (nextReview = aujourd'hui).
 */
function createCard(question, answer) {
  return {
    id: Date.now() + Math.random().toString(36).slice(2),
    question,
    answer,
    stage: 0,
    originDate: today(), // J de référence : création ou dernier échec
    nextReview: today(),
    createdAt: today(),
    correctCount: 0,
    wrongCount: 0,
  };
}
 
/** Retourne toutes les fiches dont la date de révision est passée ou aujourd'hui */
function getDueCards(cards) {
  const t = today();
  return cards.filter(c => c.nextReview <= t);
}
 
/** Retourne la date de la prochaine révision parmi les fiches non dues, ou null */
function getNextDue(cards) {
  const notDue = cards.filter(c => c.nextReview > today());
  if (!notDue.length) return null;
  notDue.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  return notDue[0].nextReview;
}
 
// ══════════════════════════════════════════════════════════
//  ÉTAT DE SESSION
// ══════════════════════════════════════════════════════════
 
let sessionQueue   = [];
let sessionIndex   = 0;
let sessionCorrect = 0;
let sessionWrong   = 0;
let answered       = false;
 
// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
 
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}
 
function navTo(id) {
  if (id === 'home')   updateHome();
  if (id === 'manage') updateManage();
  showScreen(id);
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === id);
  });
}
 
// ══════════════════════════════════════════════════════════
//  ÉCRAN ACCUEIL
// ══════════════════════════════════════════════════════════
 
function updateHome() {
  const cards    = loadCards();
  const due      = getDueCards(cards);
  const mastered = cards.filter(c => c.stage >= INTERVALS.length).length;
 
  document.getElementById('stat-total').textContent    = cards.length;
  document.getElementById('stat-due').textContent      = due.length;
  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('home-due-count').textContent = due.length;
 
  const startBtn = document.getElementById('startBtn');
  const noCards  = document.getElementById('no-cards-msg');
 
  if (cards.length === 0) {
    document.getElementById('home-due-label').textContent  = 'aucune fiche créée';
    document.getElementById('home-next-label').textContent = '';
    startBtn.disabled = true;
    noCards.classList.remove('hidden');
  } else if (due.length === 0) {
    document.getElementById('home-due-label').textContent = "aucune fiche à réviser aujourd'hui";
    const next = getNextDue(cards);
    if (next) {
      const diff = daysDiff(next);
      document.getElementById('home-next-label').textContent =
        diff === 1 ? 'Prochaine révision demain' : `Prochaine révision dans ${diff} jours`;
    }
    startBtn.disabled = true;
    noCards.classList.add('hidden');
  } else {
    document.getElementById('home-due-label').textContent =
      'fiche' + (due.length > 1 ? 's' : '') + " à réviser aujourd'hui";
    document.getElementById('home-next-label').textContent = '';
    startBtn.disabled = false;
    noCards.classList.add('hidden');
  }
}
 
// ══════════════════════════════════════════════════════════
//  SESSION DE RÉVISION
// ══════════════════════════════════════════════════════════
 
function startSession() {
  const cards = loadCards();
  sessionQueue = getDueCards(cards);
  if (!sessionQueue.length) return;
 
  // Mélange aléatoire
  sessionQueue.sort(() => Math.random() - 0.5);
  sessionIndex   = 0;
  sessionCorrect = 0;
  sessionWrong   = 0;
 
  showScreen('review');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  showCard();
}
 
function showCard() {
  if (sessionIndex >= sessionQueue.length) {
    endSession();
    return;
  }
 
  answered = false;
  const card  = sessionQueue[sessionIndex];
  const total = sessionQueue.length;
  const pct   = Math.round((sessionIndex / total) * 100);
 
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${sessionIndex} / ${total}`;
  document.getElementById('progress-pct').textContent  = pct + '%';
 
  document.getElementById('card-question').textContent = card.question;
  document.getElementById('card-answer').textContent   = card.answer;
  document.getElementById('card-answer').classList.add('hidden');
  document.getElementById('card-divider').classList.add('hidden');
  document.getElementById('card-type-badge').textContent = 'Question';
  document.getElementById('card-type-badge').className   = 'card-badge';
  document.getElementById('card-interval-label').textContent = `Étape ${card.stage + 1}`;
  document.getElementById('interval-info').textContent = '';
 
  document.getElementById('btn-reveal-container').classList.remove('hidden');
  document.getElementById('btn-eval-container').classList.add('hidden');
 
  const flashcard = document.getElementById('flashcard');
  flashcard.classList.add('slide-in');
  setTimeout(() => flashcard.classList.remove('slide-in'), 300);
}
 
function revealAnswer() {
  if (answered) return;
  answered = true;
 
  const card = sessionQueue[sessionIndex];
 
  document.getElementById('card-answer').classList.remove('hidden');
  document.getElementById('card-divider').classList.remove('hidden');
  document.getElementById('card-type-badge').textContent = 'Réponse';
  document.getElementById('card-type-badge').className   = 'card-badge answer-badge';
 
  document.getElementById('btn-reveal-container').classList.add('hidden');
  document.getElementById('btn-eval-container').classList.remove('hidden');
 
  // Aperçu des prochains intervalles depuis J
  const nextCorrectInterval = nextInterval(card.stage + 1);
  const nextCorrectDate     = addDays(card.originDate || card.createdAt, nextCorrectInterval);
  document.getElementById('interval-info').textContent =
    `✓ Correct → revu le ${nextCorrectDate}  ·  ✗ Raté → revu demain`;
}
 
function evaluate(correct) {
  const cards = loadCards();
  const card  = sessionQueue[sessionIndex];
  const idx   = cards.findIndex(c => c.id === card.id);
  if (idx === -1) { nextCard(); return; }
 
  if (correct) {
    cards[idx].stage += 1;
    cards[idx].correctCount = (cards[idx].correctCount || 0) + 1;
    // nextReview = J + intervalle, où J = origine de la fiche (createdAt ou dernierEchec)
    cards[idx].nextReview = addDays(cards[idx].originDate, nextInterval(cards[idx].stage));
    sessionCorrect++;
  } else {
    // L'échec devient le nouveau J
    cards[idx].originDate = today();
    cards[idx].stage      = 0;
    cards[idx].wrongCount = (cards[idx].wrongCount || 0) + 1;
    cards[idx].nextReview = addDays(today(), INTERVALS[0]); // nouveau J + 1
    sessionWrong++;
  }
 
  saveCards(cards);
  nextCard();
}
 
function nextCard() {
  sessionIndex++;
  setTimeout(showCard, 120);
}
 
function endSession() {
  const total = sessionCorrect + sessionWrong;
  const pct   = total ? Math.round((sessionCorrect / total) * 100) : 100;
 
  document.getElementById('end-stats').textContent =
    `${sessionCorrect} correcte${sessionCorrect !== 1 ? 's' : ''} · ` +
    `${sessionWrong} ratée${sessionWrong !== 1 ? 's' : ''} · ` +
    `${pct}% de réussite`;
 
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('progress-text').textContent = `${total} / ${total}`;
  document.getElementById('progress-pct').textContent  = '100%';
 
  showScreen('end');
}
 
// ══════════════════════════════════════════════════════════
//  AJOUT DE FICHE
// ══════════════════════════════════════════════════════════
 
function addCard() {
  const q = document.getElementById('new-question').value.trim();
  const a = document.getElementById('new-answer').value.trim();
  if (!q || !a) { showToast('Remplis la question et la réponse.'); return; }
 
  const cards = loadCards();
  cards.push(createCard(q, a));
  saveCards(cards);
 
  document.getElementById('new-question').value = '';
  document.getElementById('new-answer').value   = '';
  showToast('Fiche ajoutée ✓');
  updateHome();
}
 
// ══════════════════════════════════════════════════════════
//  GESTION DES FICHES
// ══════════════════════════════════════════════════════════
 
function updateManage() {
  const cards = loadCards();
  const list  = document.getElementById('card-list');
  const empty = document.getElementById('manage-empty');
 
  list.innerHTML = '';
  document.getElementById('manage-count').textContent =
    `${cards.length} fiche${cards.length !== 1 ? 's' : ''}`;
 
  if (!cards.length) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
 
  // Tri par date de prochaine révision
  const sorted = [...cards].sort((a, b) => a.nextReview.localeCompare(b.nextReview));
 
  sorted.forEach(card => {
    const diff      = daysDiff(card.nextReview);
    const dueLabel  = diff <= 0 ? '⚡ À réviser' : diff === 1 ? 'Demain' : `Dans ${diff} j`;
    const stageLabel = card.stage === 0
      ? 'Nouvelle'
      : card.stage < INTERVALS.length
        ? `Étape ${card.stage}/${INTERVALS.length}`
        : '★ Maîtrisée';
 
    const el = document.createElement('div');
    el.className = 'card-item';
    el.innerHTML = `
      <div class="card-item-content">
        <div class="card-item-q">${escHtml(card.question)}</div>
        <div class="card-item-meta">${dueLabel} · ${stageLabel}</div>
      </div>
      <div class="card-item-stage">${stageLabel}</div>
      <button class="card-delete" data-id="${card.id}" title="Supprimer">🗑</button>
    `;
    list.appendChild(el);
  });
 
  list.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteCard(btn.dataset.id);
    });
  });
}
 
function deleteCard(id) {
  if (!confirm('Supprimer cette fiche ?')) return;
  let cards = loadCards();
  cards = cards.filter(c => c.id !== id);
  saveCards(cards);
  updateManage();
  updateHome();
  showToast('Fiche supprimée');
}
 
// ══════════════════════════════════════════════════════════
//  IMPORT / EXPORT
// ══════════════════════════════════════════════════════════
 
function exportData() {
  const cards = loadCards();
  const blob  = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
  const a     = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `memoria-backup-${today()}.json`;
  a.click();
  showToast('Sauvegarde exportée ✓');
}
 
/**
 * Importe des fiches depuis un JSON.
 * Formats acceptés :
 *   - simple  : [{question, answer}, ...]
 *   - complet : [{id, question, answer, stage, nextReview, ...}, ...]
 * En cas de doublon (même id), la fiche existante est conservée.
 */
function importCardsFromJSON(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!Array.isArray(parsed)) throw new Error('Format invalide');
 
    const existing = loadCards();
    let added = 0;
 
    parsed.forEach(item => {
      if (!item.question || !item.answer) return;
      if (item.id) {
        if (!existing.find(c => c.id === item.id)) {
          if (!item.originDate) item.originDate = item.createdAt || today();
          existing.push(item);
          added++;
        }
      } else {
        existing.push(createCard(item.question, item.answer));
        added++;
      }
    });
 
    saveCards(existing);
    showToast(`${added} fiche${added !== 1 ? 's' : ''} importée${added !== 1 ? 's' : ''} ✓`);
    updateHome();
    updateManage();
  } catch {
    showToast('Erreur : fichier JSON invalide');
  }
}
 
// ══════════════════════════════════════════════════════════
//  UTILITAIRES UI
// ══════════════════════════════════════════════════════════
 
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
 
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
 
// ══════════════════════════════════════════════════════════
//  ÉVÉNEMENTS
// ══════════════════════════════════════════════════════════
 
// Session
document.getElementById('startBtn').addEventListener('click', startSession);
document.getElementById('revealBtn').addEventListener('click', revealAnswer);
document.getElementById('correctBtn').addEventListener('click', () => evaluate(true));
document.getElementById('wrongBtn').addEventListener('click', () => evaluate(false));
 
// Ajout
document.getElementById('addCardBtn').addEventListener('click', addCard);
document.getElementById('new-answer').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(); }
});
 
// Export
document.getElementById('exportBtn').addEventListener('click', exportData);
 
// Import — sauvegarde complète (header)
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('progressImportInput').click();
});
document.getElementById('progressImportInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => importCardsFromJSON(ev.target.result);
  r.readAsText(f);
  e.target.value = '';
});
 
// Import — cards.json simple (écran Ajouter)
document.getElementById('jsonImportArea').addEventListener('click', () => {
  document.getElementById('jsonFileInput').click();
});
document.getElementById('jsonFileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => importCardsFromJSON(ev.target.result);
  r.readAsText(f);
  e.target.value = '';
});
 
// ══════════════════════════════════════════════════════════
//  INITIALISATION
// ══════════════════════════════════════════════════════════
 
updateHome();
