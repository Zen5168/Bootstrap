/* ═══════════════════════════════════════════════════════════
   Flashcard App — Frontend Logic
═══════════════════════════════════════════════════════════ */

const App = (() => {

  // ── State ──────────────────────────────────────────────
  let currentSetId   = null;   // id of the set being viewed/edited
  let currentSet     = null;   // full set object
  let editingSetId   = null;   // null = creating new, string = editing existing
  let deleteTargetId = null;

  // Study state
  let studyCards   = [];
  let studyIndex   = 0;

  // Quiz state
  let quizCards    = [];
  let quizIndex    = 0;
  let quizCorrect  = 0;
  let quizAnswered = false;

  // Bootstrap modal instance
  let deleteModal  = null;

  // ── DOM helpers ────────────────────────────────────────
  const $ = id => document.getElementById(id);

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = $(id);
    // Force reflow so animation re-triggers
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
    el.classList.add('active');
  }

  // ── API helpers ────────────────────────────────────────
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  // ══════════════════════════════════════════════════════
  // HOME VIEW
  // ══════════════════════════════════════════════════════

  async function loadHome() {
    showView('view-home');
    const grid = $('sets-grid');
    const noMsg = $('no-sets-msg');
    grid.innerHTML = '<div class="text-muted small">Loading…</div>';
    noMsg.style.display = 'none';

    try {
      const sets = await apiFetch('/api/sets');
      grid.innerHTML = '';

      if (sets.length === 0) {
        noMsg.style.display = 'block';
        return;
      }

      sets.forEach(set => {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4';
        col.innerHTML = `
          <div class="set-card" data-id="${set.id}">
            <div class="dropdown" onclick="event.stopPropagation()">
              <button class="btn-dots" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <a class="dropdown-item" href="#"
                     onclick="event.preventDefault(); App.openEdit('${set.id}')">
                    <i class="bi bi-pencil me-2"></i>Edit
                  </a>
                </li>
                <li>
                  <a class="dropdown-item text-danger" href="#"
                     onclick="event.preventDefault(); App.confirmDelete('${set.id}', '${escapeAttr(set.name)}')">
                    <i class="bi bi-trash me-2"></i>Delete
                  </a>
                </li>
              </ul>
            </div>
            <div class="set-name">${escapeHtml(set.name)}</div>
            <div class="set-count">${set.cardCount} card${set.cardCount !== 1 ? 's' : ''}</div>
          </div>`;

        // Click card body → detail view
        col.querySelector('.set-card').addEventListener('click', () => openDetail(set.id));
        grid.appendChild(col);
      });
    } catch (e) {
      grid.innerHTML = `<div class="text-danger small">Failed to load sets: ${e.message}</div>`;
    }
  }

  // ══════════════════════════════════════════════════════
  // CREATE / EDIT VIEW
  // ══════════════════════════════════════════════════════

  function openNewSet() {
    editingSetId = null;
    $('edit-view-title').textContent = 'New Set';
    $('set-name-input').value = '';
    $('edit-error').style.display = 'none';
    renderCardRows([
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' }
    ]);
    showView('view-edit');
  }

  async function openEdit(id) {
    editingSetId = id;
    $('edit-view-title').textContent = 'Edit Set';
    $('edit-error').style.display = 'none';
    try {
      const set = await apiFetch(`/api/sets/${id}`);
      $('set-name-input').value = set.name;
      renderCardRows(set.cards);
      showView('view-edit');
    } catch (e) {
      alert('Failed to load set: ' + e.message);
    }
  }

  function renderCardRows(cards) {
    const tbody = $('cards-tbody');
    tbody.innerHTML = '';
    cards.forEach((card, i) => addCardRow(i + 1, card.question, card.answer));
  }

  function addCardRow(num, question = '', answer = '') {
    const tbody = $('cards-tbody');
    const rowNum = num || tbody.rows.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="row-num">${rowNum}</td>
      <td><input type="text" class="borderless card-question" placeholder="Question" value="${escapeAttr(question)}" /></td>
      <td><input type="text" class="borderless card-answer"   placeholder="Answer"   value="${escapeAttr(answer)}" /></td>
      <td>
        <button class="btn-remove" title="Remove row" onclick="App.removeCardRow(this)">
          <i class="bi bi-x-lg"></i>
        </button>
      </td>`;
    tbody.appendChild(tr);
  }

  function removeCardRow(btn) {
    const tr = btn.closest('tr');
    tr.remove();
    // Re-number rows
    document.querySelectorAll('#cards-tbody tr').forEach((row, i) => {
      row.querySelector('.row-num').textContent = i + 1;
    });
  }

  async function saveSet() {
    const name = $('set-name-input').value.trim();
    const errEl = $('edit-error');
    errEl.style.display = 'none';

    if (!name) {
      errEl.textContent = 'Please enter a set name.';
      errEl.style.display = 'block';
      return;
    }

    const rows = document.querySelectorAll('#cards-tbody tr');
    const cards = [];
    rows.forEach(row => {
      const q = row.querySelector('.card-question').value.trim();
      const a = row.querySelector('.card-answer').value.trim();
      if (q && a) cards.push({ question: q, answer: a });
    });

    if (cards.length === 0) {
      errEl.textContent = 'Please add at least one complete card (question + answer).';
      errEl.style.display = 'block';
      return;
    }

    try {
      if (editingSetId) {
        await apiFetch(`/api/sets/${editingSetId}`, {
          method: 'PUT',
          body: JSON.stringify({ name, cards })
        });
      } else {
        await apiFetch('/api/sets', {
          method: 'POST',
          body: JSON.stringify({ name, cards })
        });
      }
      loadHome();
    } catch (e) {
      errEl.textContent = 'Save failed: ' + e.message;
      errEl.style.display = 'block';
    }
  }

  // ══════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════

  async function openDetail(id) {
    currentSetId = id;
    try {
      const set = await apiFetch(`/api/sets/${id}`);
      currentSet = set;

      $('detail-set-title').textContent = set.name;
      $('detail-card-count').textContent = `${set.cards.length} card${set.cards.length !== 1 ? 's' : ''}`;

      // Preview table (first 10)
      const tbody = $('preview-tbody');
      tbody.innerHTML = '';
      const preview = set.cards.slice(0, 10);
      preview.forEach((card, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-muted">${i + 1}</td>
          <td>${escapeHtml(card.question)}</td>
          <td>${escapeHtml(card.answer)}</td>`;
        tbody.appendChild(tr);
      });

      const moreEl = $('preview-more');
      if (set.cards.length > 10) {
        moreEl.textContent = `…and ${set.cards.length - 10} more card${set.cards.length - 10 !== 1 ? 's' : ''}`;
        moreEl.style.display = 'block';
      } else {
        moreEl.style.display = 'none';
      }

      showView('view-detail');
    } catch (e) {
      alert('Failed to load set: ' + e.message);
    }
  }

  // ══════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════

  function confirmDelete(id, name) {
    deleteTargetId = id;
    $('delete-set-name').textContent = name;
    deleteModal.show();
  }

  async function doDelete() {
    if (!deleteTargetId) return;
    try {
      await apiFetch(`/api/sets/${deleteTargetId}`, { method: 'DELETE' });
      deleteModal.hide();
      deleteTargetId = null;
      // If we were on detail view for this set, go home
      if (currentSetId === deleteTargetId) currentSetId = null;
      loadHome();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  // ══════════════════════════════════════════════════════
  // STUDY MODE
  // ══════════════════════════════════════════════════════

  function openStudy() {
    if (!currentSet || currentSet.cards.length === 0) return;
    studyCards = currentSet.cards;
    studyIndex = 0;
    renderStudyCard(false);
    showView('view-study');
  }

  function renderStudyCard(animate, direction) {
    const container = $('study-card-container');
    const card      = $('study-card');
    const nextBtn   = $('study-next-btn');

    if (animate) {
      const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
      const inClass  = direction === 'next' ? 'slide-in-right' : 'slide-in-left';

      container.classList.add(outClass);
      setTimeout(() => {
        container.classList.remove(outClass);

        // Reset flip WITHOUT animation
        card.style.transition = 'none';
        card.classList.remove('flipped');
        card.offsetHeight; // force reflow
        card.style.transition = '';

        // Update content
        $('study-question').textContent = studyCards[studyIndex].question;
        $('study-answer').textContent   = studyCards[studyIndex].answer;
        updateStudyUI();

        container.classList.add(inClass);
        setTimeout(() => container.classList.remove(inClass), 150);
      }, 150);
    } else {
      // No animation (initial render)
      card.style.transition = 'none';
      card.classList.remove('flipped');
      card.offsetHeight;
      card.style.transition = '';

      $('study-question').textContent = studyCards[studyIndex].question;
      $('study-answer').textContent   = studyCards[studyIndex].answer;
      updateStudyUI();
    }
  }

  function updateStudyUI() {
    $('study-progress').textContent = `${studyIndex + 1} / ${studyCards.length}`;
    $('study-prev-btn').disabled = studyIndex === 0;

    if (studyIndex === studyCards.length - 1) {
      $('study-next-btn').innerHTML = 'Done';
    } else {
      $('study-next-btn').innerHTML = 'Next<i class="bi bi-arrow-right ms-1"></i>';
    }
  }

  function studyFlip() {
    $('study-card').classList.toggle('flipped');
  }

  function studyNext() {
    if (studyIndex === studyCards.length - 1) {
      openDetail(currentSetId);
      return;
    }
    studyIndex++;
    renderStudyCard(true, 'next');
  }

  function studyPrev() {
    if (studyIndex === 0) return;
    studyIndex--;
    renderStudyCard(true, 'prev');
  }

  // ══════════════════════════════════════════════════════
  // QUIZ MODE
  // ══════════════════════════════════════════════════════

  function openQuiz() {
    if (!currentSet || currentSet.cards.length === 0) return;
    // Shuffle cards
    quizCards = shuffle([...currentSet.cards]);
    quizIndex   = 0;
    quizCorrect = 0;
    quizAnswered = false;

    $('quiz-active').style.display   = 'block';
    $('quiz-complete').style.display = 'none';

    renderQuizCard(false);
    showView('view-quiz');
  }

  function renderQuizCard(animate, direction) {
    const container = $('quiz-card-container');
    const card      = $('quiz-card');

    const doRender = () => {
      // Reset flip WITHOUT animation
      card.style.transition = 'none';
      card.classList.remove('flipped');
      card.offsetHeight; // force reflow
      card.style.transition = '';

      $('quiz-question').textContent = quizCards[quizIndex].question;
      $('quiz-answer').textContent   = quizCards[quizIndex].answer;

      // Reset input + feedback
      $('quiz-answer-input').value = '';
      $('quiz-answer-input').disabled = false;
      $('quiz-submit-btn').disabled = false;
      $('quiz-feedback').style.display = 'none';
      $('quiz-feedback').innerHTML = '';
      $('quiz-next-row').style.display = 'none';
      $('quiz-input-row').style.display = 'flex';

      quizAnswered = false;
      updateQuizUI();

      setTimeout(() => $('quiz-answer-input').focus(), 50);
    };

    if (animate) {
      const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
      const inClass  = direction === 'next' ? 'slide-in-right' : 'slide-in-left';

      container.classList.add(outClass);
      setTimeout(() => {
        container.classList.remove(outClass);
        doRender();
        container.classList.add(inClass);
        setTimeout(() => container.classList.remove(inClass), 150);
      }, 150);
    } else {
      doRender();
    }
  }

  function updateQuizUI() {
    $('quiz-progress').textContent = `${quizIndex + 1} / ${quizCards.length}`;
    $('quiz-score').textContent    = `Score: ${quizCorrect}`;
  }

  function quizSubmit() {
    if (quizAnswered) return;

    const userAnswer = $('quiz-answer-input').value.trim();
    if (!userAnswer) return;

    quizAnswered = true;
    $('quiz-answer-input').disabled = true;
    $('quiz-submit-btn').disabled   = true;

    const correct = quizCards[quizIndex].answer;
    const isRight = normalize(userAnswer) === normalize(correct);

    if (isRight) quizCorrect++;

    // Flip card to show answer
    $('quiz-card').classList.add('flipped');

    // Sound + visual effects
    const scene = $('quiz-scene');
    if (isRight) {
      playCorrectSound();
      flashCorrect(scene);
      spawnParticles(scene);
    } else {
      playWrongSound();
      flashWrong(scene);
    }

    // Show feedback
    const fb = $('quiz-feedback');
    fb.style.display = 'block';
    if (isRight) {
      fb.innerHTML = '<span class="feedback-correct"><i class="bi bi-check-circle-fill me-1"></i>Correct!</span>';
    } else {
      fb.innerHTML = `<span class="feedback-wrong"><i class="bi bi-x-circle-fill me-1"></i>Wrong.</span>
        <div class="text-muted small mt-1">Correct answer: <strong>${escapeHtml(correct)}</strong></div>`;
    }

    updateQuizUI();

    // Show next button
    $('quiz-next-row').style.display = 'flex';
  }

  function quizNext() {
    if (quizIndex === quizCards.length - 1) {
      showQuizComplete();
      return;
    }
    quizIndex++;
    renderQuizCard(true, 'next');
  }

  function showQuizComplete() {
    $('quiz-active').style.display   = 'none';
    $('quiz-complete').style.display = 'block';
    const pct = Math.round((quizCorrect / quizCards.length) * 100);
    $('quiz-complete-msg').textContent =
      `You got ${quizCorrect} out of ${quizCards.length} correct (${pct}%).`;
  }

  // ══════════════════════════════════════════════════════
  // SOUND EFFECTS  (Web Audio API — no external files)
  // ══════════════════════════════════════════════════════

  function playCorrectSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Three quick ascending clap-like bursts
      [0, 0.12, 0.24].forEach((offset, i) => {
        // Noise burst (clap body)
        const bufLen = ctx.sampleRate * 0.08;
        const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data   = buf.getChannelData(0);
        for (let s = 0; s < bufLen; s++) {
          data[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / bufLen, 3);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        // Band-pass to make it sound like a clap
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + i * 300;
        bp.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.1);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(ctx.destination);
        src.start(ctx.currentTime + offset);
        src.stop(ctx.currentTime + offset + 0.15);
      });

      // Cheerful ascending tone on top
      const osc  = ctx.createOscillator();
      const gOsc = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.05);   // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.18);   // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.31);   // G5
      gOsc.gain.setValueAtTime(0.25, ctx.currentTime + 0.05);
      gOsc.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gOsc);
      gOsc.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.05);
      osc.stop(ctx.currentTime + 0.6);

      setTimeout(() => ctx.close(), 800);
    } catch (_) { /* audio not supported */ }
  }

  function playWrongSound() {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);

      setTimeout(() => ctx.close(), 600);
    } catch (_) { /* audio not supported */ }
  }

  // ══════════════════════════════════════════════════════
  // VISUAL EFFECTS
  // ══════════════════════════════════════════════════════

  function spawnParticles(originEl) {
    const rect    = originEl.getBoundingClientRect();
    const cx      = rect.left + rect.width  / 2;
    const cy      = rect.top  + rect.height / 2;
    const colors  = ['#ff6b00', '#ff9a00', '#ffcc00', '#fff', '#ff4500'];
    const count   = 28;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'fx-particle';
      const angle  = (i / count) * 360;
      const dist   = 60 + Math.random() * 80;
      const size   = 6 + Math.random() * 8;
      const color  = colors[Math.floor(Math.random() * colors.length)];
      const dur    = 0.55 + Math.random() * 0.3;

      p.style.cssText = `
        left:${cx}px; top:${cy}px;
        width:${size}px; height:${size}px;
        background:${color};
        --dx:${Math.cos((angle * Math.PI) / 180) * dist}px;
        --dy:${Math.sin((angle * Math.PI) / 180) * dist}px;
        animation: particleBurst ${dur}s ease-out forwards;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), (dur + 0.1) * 1000);
    }
  }

  function flashCorrect(el) {
    el.classList.remove('fx-wrong');
    el.classList.add('fx-correct');
    setTimeout(() => el.classList.remove('fx-correct'), 700);
  }

  function flashWrong(el) {
    el.classList.remove('fx-correct');
    el.classList.add('fx-wrong');
    setTimeout(() => el.classList.remove('fx-wrong'), 700);
  }

  // ══════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function normalize(str) {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ══════════════════════════════════════════════════════
  // INIT — wire up all event listeners
  // ══════════════════════════════════════════════════════

  function init() {
    deleteModal = new bootstrap.Modal($('deleteModal'));

    // Navbar brand → home
    $('nav-brand').addEventListener('click', loadHome);

    // Home view
    $('btn-new-set').addEventListener('click', openNewSet);

    // Edit view
    $('edit-back-btn').addEventListener('click', () => {
      if (editingSetId) {
        openDetail(editingSetId);
      } else {
        loadHome();
      }
    });
    $('btn-add-card').addEventListener('click', () => {
      const count = document.querySelectorAll('#cards-tbody tr').length;
      addCardRow(count + 1);
    });
    $('btn-save-set').addEventListener('click', saveSet);

    // Detail view
    $('detail-back-btn').addEventListener('click', loadHome);
    $('detail-edit-btn').addEventListener('click', () => openEdit(currentSetId));
    $('detail-delete-btn').addEventListener('click', () => {
      if (currentSet) confirmDelete(currentSet.id, currentSet.name);
    });
    $('btn-study-mode').addEventListener('click', openStudy);
    $('btn-quiz-mode').addEventListener('click', openQuiz);

    // Delete modal
    $('confirm-delete-btn').addEventListener('click', doDelete);

    // Study view
    $('study-back-btn').addEventListener('click', () => openDetail(currentSetId));
    $('study-prev-btn').addEventListener('click', studyPrev);
    $('study-next-btn').addEventListener('click', studyNext);

    // Quiz view
    $('quiz-back-btn').addEventListener('click', () => openDetail(currentSetId));
    $('quiz-submit-btn').addEventListener('click', quizSubmit);
    $('quiz-answer-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') quizSubmit();
    });
    $('quiz-next-btn').addEventListener('click', quizNext);
    $('quiz-retry-btn').addEventListener('click', openQuiz);
    $('quiz-done-btn').addEventListener('click', () => openDetail(currentSetId));

    // Load home on start
    loadHome();
  }

  // ── Public API ─────────────────────────────────────────
  return {
    init,
    studyFlip,
    openEdit,
    confirmDelete,
    removeCardRow
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
