// frontend/cards.js
const API = '/api';
const CARD_LIMIT = 100;
const debounce = (fn, wait=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

function idFromIndex(cards) {
  // create next short id card_XXX from existing cards
  let max = 0;
  cards.forEach(c=>{
    const m = (c.id || '').match(/^card_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1],10));
  });
  return `card_${String(max+1).padStart(3,'0')}`;
}

function createCardDOM(card) {
  const tpl = document.getElementById('cardTpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = card.id;
  node.querySelector('.cardTitle').value = card.title || '';
  node.querySelector('.cardType').value = card.type || 'scene';
  node.querySelector('.cardContent').value = card.content || '';
  node.querySelector('.cardContent').style.height = 'auto';
  node.querySelector('.cardContent').style.height = (node.querySelector('.cardContent').scrollHeight + 2) + 'px';
  // tags
  const tagRow = node.querySelector('.tagRow');
  (card.tags || []).forEach(t=>{
    const chip = document.createElement('div');
    chip.className = 'tag';
    chip.textContent = t;
    tagRow.appendChild(chip);
  });

  // event handlers
  node.querySelector('.cardContent').addEventListener('input', autosizeAndSaveDebounced);
  node.querySelector('.cardTitle').addEventListener('input', saveDebounced);
  node.querySelector('.cardType').addEventListener('change', saveDebounced);

  node.querySelector('.deleteCard').addEventListener('click', async ()=> {
    if (!confirm('Delete this card?')) return;
    node.remove();
    await saveAllCards();
  });

  node.querySelector('.addTag').addEventListener('click', async ()=>{
    const tag = prompt('Enter tag (no #):');
    if (!tag) return;
    const chip = document.createElement('div');
    chip.className = 'tag';
    chip.textContent = tag;
    node.querySelector('.tagRow').appendChild(chip);
    await saveAllCards();
  });

  // collapse toggle
  const collapseBtn = node.querySelector('.collapseBtn');
  collapseBtn.addEventListener('click', ()=>{
    const body = node.querySelector('.cardBody');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      collapseBtn.textContent = '▾';
    } else {
      body.style.display = 'none';
      collapseBtn.textContent = '▸';
    }
  });

  // drag handlers
  node.addEventListener('dragstart', (e)=>{
    e.dataTransfer.setData('text/plain', node.dataset.id);
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', ()=> node.classList.remove('dragging'));
  node.addEventListener('dragover', (e)=>{
    e.preventDefault();
    const after = getDragAfterElement(e.clientY);
    const container = document.getElementById('cardsColumn');
    const dragging = document.querySelector('.dragging');
    if (!after) container.appendChild(dragging);
    else container.insertBefore(dragging, after);
  });

  return node;
}

function getDragAfterElement(y) {
  const container = document.getElementById('cardsColumn');
  const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function loadCards() {
  const cards = await fetchJSON(API + '/cards');
  renderCards(cards);
  const story = await fetchJSON(API + '/story');
  document.getElementById('storyText').value = story.text || '';
  updateNewCardBtnState(cards.length);
}

function renderCards(cards) {
  const container = document.getElementById('cardsColumn');
  container.innerHTML = '';
  cards.forEach(c => {
    const el = createCardDOM(c);
    container.appendChild(el);
  });
}

function collectCardsFromDOM() {
  const nodes = document.querySelectorAll('#cardsColumn .card');
  const arr = Array.from(nodes).map(node => {
    const tags = Array.from(node.querySelectorAll('.tag')).map(t => t.textContent);
    const metaEl = node.dataset.meta ? JSON.parse(node.dataset.meta) : null;
    return {
      id: node.dataset.id || '',
      title: node.querySelector('.cardTitle').value,
      type: node.querySelector('.cardType').value,
      content: node.querySelector('.cardContent').value,
      tags,
      meta: metaEl || { version: 1, updatedAt: Date.now() }
    };
  });
  return arr;
}

async function saveAllCards() {
  const arr = collectCardsFromDOM();
  setSaveStatus('saving...');

  const res = await fetch(API + '/cards', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(arr)
  });

  if (res.status === 409) {
    const data = await res.json();
    showConflictModal(data.conflicts);
    setSaveStatus('conflict');
    return;
  }

  if (!res.ok) {
    setSaveStatus('error');
    return;
  }

  // DO NOT reload cards here
  setSaveStatus('saved');
}


const saveDebounced = debounce(()=> saveAllCards(), 700);
const autosizeAndSaveDebounced = debounce((e)=>{
  e.target.style.height = 'auto';
  e.target.style.height = (e.target.scrollHeight + 2) + 'px';
  saveAllCards();
}, 500);

document.getElementById('refreshBtn').addEventListener('click', loadCards);

document.getElementById('newCardBtn').addEventListener('click', async () => {
  // fetch current cards to compute next id
  const existing = await fetchJSON(API + '/cards');
  if (existing.length >= CARD_LIMIT) {
    alert(`Card limit reached (${CARD_LIMIT}).`);
    updateNewCardBtnState(existing.length);
    return;
  }
  const nextId = idFromIndex(existing);
  const newCard = {
    id: nextId,
    title: 'New Card',
    type: 'note',
    content: '',
    tags: [],
    meta: { version: 1, updatedAt: Date.now() }
  };
  // append DOM then save
  const container = document.getElementById('cardsColumn');
  const el = createCardDOM(newCard);
  container.appendChild(el);
  await saveAllCards();
});

document.getElementById('applyStory').addEventListener('click', async () => {
  const text = document.getElementById('storyText').value;
  await fetch(API + '/story', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) });
  setTimeout(loadCards, 300);
});

document.getElementById('searchMem').addEventListener('input', debounce(async (e)=>{
  const q = e.target.value;
  if (!q) { document.getElementById('memResults').innerHTML = ''; return; }
  const res = await fetchJSON(API + '/mem/search?q=' + encodeURIComponent(q) + '&top=6');
  const cont = document.getElementById('memResults');
  cont.innerHTML = '';
  res.forEach(r => {
    const div = document.createElement('div');
    div.className = 'mem-item';
    div.innerHTML = `<strong>${(r.score||0).toFixed(3)}</strong> — ${r.text.slice(0,200)}`;
    cont.appendChild(div);
  });
}, 300));

function setSaveStatus(s) {
  const el = document.getElementById('saveStatus');
  el.textContent = s;
}

function updateNewCardBtnState(count) {
  const btn = document.getElementById('newCardBtn');
  if (count >= CARD_LIMIT) {
    btn.disabled = true;
    btn.textContent = '+ New Card (limit reached)';
    btn.style.opacity = '0.6';
  } else {
    btn.disabled = false;
    btn.textContent = '+ New Card';
    btn.style.opacity = '1';
  }
}

/* Conflict modal logic */
function showConflictModal(conflicts) {
  const modal = document.getElementById('conflictModal');
  const list = document.getElementById('conflictList');
  list.innerHTML = '';
  conflicts.forEach(c => {
    const div = document.createElement('div');
    div.className = 'conflict-card';
    div.dataset.cardId = c.id;
    div.innerHTML = `
      <strong>${c.id}</strong>
      <div class="small-muted">Server version (updatedAt: ${new Date(c.server.meta.updatedAt).toLocaleString()})</div>
      <textarea class="serverText" readonly style="width:100%;height:80px;">${c.server.content}</textarea>
      <div class="small-muted">Your version (incoming)</div>
      <textarea class="incomingText" style="width:100%;height:80px;">${c.incoming.content}</textarea>
      <div style="margin-top:8px;">
        <label><input type="radio" name="choice_${c.id}" value="incoming" checked /> Keep incoming</label>
        &nbsp;
        <label><input type="radio" name="choice_${c.id}" value="server" /> Keep server</label>
        &nbsp;
        <label><input type="radio" name="choice_${c.id}" value="merge" /> Merge manually</label>
      </div>
    `;
    list.appendChild(div);
  });

  modal.classList.remove('hidden');

  document.getElementById('applyConflicts').onclick = async () => {
    // build resolved cards array
    const resolved = [];
    const nodes = list.querySelectorAll('.conflict-card');
    for (const n of nodes) {
      const id = n.dataset.cardId;
      const choice = (n.querySelector(`input[name="choice_${id}"]:checked`) || {}).value;
      const serverText = n.querySelector('.serverText').value;
      const incomingText = n.querySelector('.incomingText').value;
      let finalText = incomingText;
      if (choice === 'server') finalText = serverText;
      if (choice === 'merge') {
        // allow user-edit, use content from incomingText (they can edit before applying)
        finalText = n.querySelector('.incomingText').value;
      }
      // fetch latest cards and replace matched id with resolved text
      resolved.push({ id, content: finalText });
    }
    // fetch current server cards
    const serverCards = await fetchJSON(API + '/cards');
    // apply resolved content in serverCards
    for (const r of resolved) {
      const idx = serverCards.findIndex(c => c.id === r.id);
      if (idx >= 0) serverCards[idx].content = r.content;
    }
    // send full replace
    setSaveStatus('saving...');
    const resp = await fetch(API + '/cards', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(serverCards) });
    if (resp.ok) {
      modal.classList.add('hidden');
      setSaveStatus('saved');
      setTimeout(loadCards, 250);
    } else {
      alert('Failed to apply resolutions.');
      setSaveStatus('error');
    }
  };

  document.getElementById('dismissConflicts').onclick = () => { modal.classList.add('hidden'); };
}

window.addEventListener('DOMContentLoaded', () => {
  loadCards();
  // autosave story
  const storyArea = document.getElementById('storyText');
  storyArea.addEventListener('input', debounce(async () => {
    await fetch(API + '/story', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text: storyArea.value }) });
  }, 500));
});
