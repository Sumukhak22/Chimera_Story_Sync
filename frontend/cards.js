// frontend/cards.js
const API = '/api';
const CARD_LIMIT = 100;

// simple debounce
const debounce = (fn, wait = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

function idFromIndex(cards) {
  // create next short id card_XXX from existing cards
  let max = 0;
  cards.forEach(c => {
    const m = (c.id || '').match(/^card_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `card_${String(max + 1).padStart(3, '0')}`;
}

/* ---------- Connection state (UI-only, localStorage) ---------- */

let connectMode = false;
let selectedFromId = null;
let connections = []; // { from, to }
let latestCards = []; // for viz views

const CONNECTIONS_KEY = 'chimeraConnections';

function loadConnectionsFromStorage() {
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY);
    connections = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(connections)) connections = [];
  } catch {
    connections = [];
  }
}

function saveConnectionsToStorage() {
  try {
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections));
  } catch {
    // ignore
  }
}

function clearConnectionHighlights() {
  document.querySelectorAll('.card.card-connect-selected')
    .forEach(c => c.classList.remove('card-connect-selected'));
  document.querySelectorAll('.pinBtn.pin-active')
    .forEach(p => p.classList.remove('pin-active'));
}

function setConnectMode(on) {
  connectMode = on;
  selectedFromId = null;
  clearConnectionHighlights();
  const btn = document.getElementById('connectModeBtn');
  if (btn) btn.classList.toggle('active', connectMode);
  setSaveStatus(connectMode ? 'connect: select first card' : 'idle');
}

function handlePinClick(cardId, pinEl) {
  if (!connectMode) {
    // small pulse when not in connect mode
    pinEl.classList.add('pin-active');
    setTimeout(() => pinEl.classList.remove('pin-active'), 220);
    return;
  }

  const cardEl = document.querySelector(`.card[data-id="${cardId}"]`);
  if (!cardEl) return;

  if (!selectedFromId) {
    // choose first
    selectedFromId = cardId;
    cardEl.classList.add('card-connect-selected');
    pinEl.classList.add('pin-active');
    setSaveStatus('connect: select second card');
    return;
  }

  if (selectedFromId === cardId) {
    // cancel selection
    selectedFromId = null;
    cardEl.classList.remove('card-connect-selected');
    pinEl.classList.remove('pin-active');
    setSaveStatus('connect: cancelled');
    return;
  }

  // add connection (avoid duplicate in either direction)
  if (!connections.some(c =>
    (c.from === selectedFromId && c.to === cardId) ||
    (c.from === cardId && c.to === selectedFromId)
  )) {
    connections.push({ from: selectedFromId, to: cardId });
    saveConnectionsToStorage();
    drawConnections();
    setSaveStatus('connection added');
  }

  // clear selection
  clearConnectionHighlights();
  selectedFromId = null;
}

/* ---------- Card DOM creation ---------- */

function createCardDOM(card) {
  const tpl = document.getElementById('cardTpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = card.id;

  const titleEl = node.querySelector('.cardTitle');
  const typeEl = node.querySelector('.cardType');
  const contentEl = node.querySelector('.cardContent');

  titleEl.value = card.title || '';
  typeEl.value = card.type || 'scene';
  contentEl.value = card.content || '';
  contentEl.style.height = 'auto';
  contentEl.style.height = (contentEl.scrollHeight + 2) + 'px';

  // tags
  const tagRow = node.querySelector('.tagRow');
  (card.tags || []).forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'tag';
    chip.textContent = t;
    tagRow.appendChild(chip);
  });

  // pin click
  const pinBtn = node.querySelector('.pinBtn');
  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handlePinClick(card.id, pinBtn);
  });

  // event handlers
  contentEl.addEventListener('input', autosizeAndSaveDebounced);
  titleEl.addEventListener('input', saveDebounced);
  typeEl.addEventListener('change', saveDebounced);

  node.querySelector('.deleteCard').addEventListener('click', async () => {
    if (!confirm('Delete this card?')) return;
    // remove all connections involving this card (UI only)
    connections = connections.filter(c => c.from !== card.id && c.to !== card.id);
    saveConnectionsToStorage();
    node.remove();
    drawConnections();
    await saveAllCards();
  });

  node.querySelector('.addTag').addEventListener('click', async () => {
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
  collapseBtn.addEventListener('click', () => {
    const body = node.querySelector('.cardBody');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      collapseBtn.textContent = '▾';
    } else {
      body.style.display = 'none';
      collapseBtn.textContent = '▸';
    }
    // redraw lines in case card height changed a lot
    drawConnections();
  });

  // drag handlers (reorder)
  node.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', node.dataset.id);
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', () => {
    node.classList.remove('dragging');
    drawConnections();
  });
  node.addEventListener('dragover', (e) => {
    e.preventDefault();
    const after = getDragAfterElement(e.clientY);
    const container = document.getElementById('cardsColumn');
    const dragging = document.querySelector('.dragging');
    if (!dragging) return;
    if (!after) container.appendChild(dragging);
    else container.insertBefore(dragging, after);
  });

  return node;
}

function getDragAfterElement(y) {
  const container = document.getElementById('cardsColumn');
  const draggableElements = Array.from(container.querySelectorAll('.card:not(.dragging)'));
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

/* ---------- Load / render / save ---------- */

async function loadCards() {
  const cards = await fetchJSON(API + '/cards');
  latestCards = Array.isArray(cards) ? cards.slice() : [];
  renderCards(cards);

  const story = await fetchJSON(API + '/story');
  const storyEl = document.getElementById('storyText');
  if (storyEl) storyEl.value = story.text || '';

  updateNewCardBtnState((cards || []).length);

  // Build visual views from latest cards
  buildMindmapView(latestCards);
  buildBeamView(latestCards);

  // redraw connections after layout
  drawConnections();
}

function renderCards(cards) {
  const container = document.getElementById('cardsColumn');
  container.innerHTML = '';
  (cards || []).forEach(c => {
    const el = createCardDOM(c);
    container.appendChild(el);
  });
  // after layout / DOM changes, repaint lines
  requestAnimationFrame(drawConnections);
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
  latestCards = arr.slice();
  setSaveStatus('saving.');

  const res = await fetch(API + '/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

  setSaveStatus('saved');
  // update visual views too
  buildMindmapView(latestCards);
  buildBeamView(latestCards);
}

const saveDebounced = debounce(() => saveAllCards(), 700);
const autosizeAndSaveDebounced = debounce((e) => {
  e.target.style.height = 'auto';
  e.target.style.height = (e.target.scrollHeight + 2) + 'px';
  saveAllCards();
}, 500);

/* ---------- Connection drawing (SVG) ---------- */

function drawConnections() {
  const board = document.querySelector('.board');
  const svg = document.getElementById('connectionLayer');
  if (!board || !svg) return;

  const rectBoard = board.getBoundingClientRect();
  const width = rectBoard.width;
  const height = rectBoard.height;

  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.innerHTML = '';

  if (!connections.length) return;

  connections.forEach(conn => {
    const cardFrom = document.querySelector(`.card[data-id="${conn.from}"]`);
    const cardTo = document.querySelector(`.card[data-id="${conn.to}"]`);
    if (!cardFrom || !cardTo) return;

    const pinFrom = cardFrom.querySelector('.pinBtn');
    const pinTo = cardTo.querySelector('.pinBtn');
    if (!pinFrom || !pinTo) return;

    const r1 = pinFrom.getBoundingClientRect();
    const r2 = pinTo.getBoundingClientRect();

    const x1 = r1.left + r1.width / 2 - rectBoard.left;
    const y1 = r1.top + r1.height / 2 - rectBoard.top;
    const x2 = r2.left + r2.width / 2 - rectBoard.left;
    const y2 = r2.top + r2.height / 2 - rectBoard.top;

    const midY = (y1 + y2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-line');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
    svg.appendChild(path);
  });
}

/* ---------- UI helpers ---------- */

function setSaveStatus(s) {
  const el = document.getElementById('saveStatus');
  if (el) el.textContent = s;
}

function updateNewCardBtnState(count) {
  const btn = document.getElementById('newCardBtn');
  if (!btn) return;
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

/* ---------- Mindmap view (numbered hierarchy) ---------- */

function buildMindmapView(cards) {
  const root = document.getElementById('mindmapView');
  if (!root) return;
  root.innerHTML = '';

  const scenes = (cards || []).filter(c =>
    (c.type || '').toLowerCase() === 'scene'
  );

  if (!scenes.length) {
    root.innerHTML = '<div class="beam-empty">No scenes yet. Add scene-type cards to see them here.</div>';
    return;
  }

  // Helper: extract numbering from title → "1.2.1"
  function getNumbering(title) {
    if (!title) return null;
    const match = title.trim().match(/^(\d+(?:\.\d+)*)\b/);
    return match ? match[1] : null;
  }

  // Build structure tree
  const tree = [];
  const stack = [];

  scenes.forEach(scene => {
    const num = getNumbering(scene.title || '');
    const node = {
      scene,
      number: num,
      children: []
    };

    if (!num) {
      // No numbering → treat as top-level
      tree.push(node);
      return;
    }

    const level = num.split('.').length;

    // Maintain a stack of last nodes per level
    while (stack.length >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level number (e.g., "1", "2")
      tree.push(node);
    } else {
      // Child node (e.g., "1.1", "1.2.3")
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  // Render tree recursively
  function renderNodes(nodes, parentEl) {
    const ul = document.createElement('ul');
    ul.className = 'mm-list';

    nodes.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mm-node';

      const label = document.createElement('div');
      label.className = 'mm-node-label';

      // Display numbering
      const idxSpan = document.createElement('span');
      idxSpan.className = 'mm-scene-index';
      idxSpan.textContent = n.number || '';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'mm-node-title';
      titleSpan.textContent = n.scene.title || '(untitled scene)';

      label.appendChild(idxSpan);
      label.appendChild(titleSpan);

      // Optional pill for tags
      if (n.scene.tags && n.scene.tags.length) {
        const pill = document.createElement('span');
        pill.className = 'mm-node-pill';
        pill.textContent = n.scene.tags.join(', ');
        label.appendChild(pill);
      }

      // Add collapse toggle only if children exist
      let toggle = null;
      if (n.children.length > 0) {
        toggle = document.createElement('span');
        toggle.className = 'mm-toggle';
        toggle.textContent = '▾';
        label.appendChild(toggle);

        label.addEventListener('click', () => {
          li.classList.toggle('mm-collapsed');
          toggle.textContent = li.classList.contains('mm-collapsed') ? '▸' : '▾';
        });
      }

      li.appendChild(label);

      if (n.children.length > 0) {
        const childContainer = document.createElement('div');
        childContainer.className = 'mm-children';
        renderNodes(n.children, childContainer);
        li.appendChild(childContainer);
      }

      ul.appendChild(li);
    });

    parentEl.appendChild(ul);
  }

  // Root rendering
  const wrapper = document.createElement('div');
  wrapper.className = 'mm-root';

  const title = document.createElement('div');
  title.className = 'mm-root-title';
  title.textContent = 'Story';

  wrapper.appendChild(title);
  renderNodes(tree, wrapper);
  root.appendChild(wrapper);
}

/* ---------- Beam view (character → scenes) ---------- */

function buildBeamView(cards) {
  const root = document.getElementById('beamView');
  if (!root) return;
  root.innerHTML = '';

  const list = Array.isArray(cards) ? cards : [];
  const scenes = list.filter(c => (c.type || '').toLowerCase() === 'scene');
  const chars  = list.filter(c => (c.type || '').toLowerCase() === 'character');

  if (!chars.length || !scenes.length) {
    root.innerHTML = '<div class="beam-empty">Add character and scene cards to view relations.</div>';
    return;
  }

  const rowsFrag = document.createDocumentFragment();

  chars.forEach(ch => {
    const chName = (ch.title || '').trim();
    if (!chName) return;

    const chNameLower = chName.toLowerCase();

    const relatedScenes = scenes.filter(sc => {
      const text = `${sc.title || ''}\n${sc.content || ''}`.toLowerCase();
      const tags = (sc.tags || []).join(' ').toLowerCase();
      return text.includes(chNameLower) || tags.includes(chNameLower);
    });

    const row = document.createElement('div');
    row.className = 'beam-row';

    const charBox = document.createElement('div');
    charBox.className = 'beam-char';
    const charLabel = document.createElement('span');
    charLabel.textContent = chName;
    const charMeta = document.createElement('span');
    charMeta.textContent = relatedScenes.length
      ? `${relatedScenes.length} scene${relatedScenes.length > 1 ? 's' : ''}`
      : '0 scenes';
    charBox.appendChild(charLabel);
    charBox.appendChild(charMeta);

    const scenesBox = document.createElement('div');
    scenesBox.className = 'beam-scenes';

    if (!relatedScenes.length) {
      const chip = document.createElement('div');
      chip.className = 'beam-scene-chip';
      chip.textContent = 'Not yet in any scene';
      scenesBox.appendChild(chip);
    } else {
      relatedScenes.forEach(sc => {
        const chip = document.createElement('div');
        chip.className = 'beam-scene-chip';
        chip.textContent = sc.title || '(untitled scene)';
        scenesBox.appendChild(chip);
      });
    }

    row.appendChild(charBox);
    row.appendChild(scenesBox);
    rowsFrag.appendChild(row);
  });

  root.appendChild(rowsFrag);
}

/* Visual views tab switching */

function initVizTabs() {
  const tabs = document.querySelectorAll('.viz-tab');
  const views = {
    mindmap: document.getElementById('mindmapView'),
    beam: document.getElementById('beamView')
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.vtab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.viz-view').forEach(v => v.classList.remove('active'));
      if (views[key]) views[key].classList.add('active');
    });
  });
}

/* Conflict modal logic (unchanged) */
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
        finalText = n.querySelector('.incomingText').value;
      }
      resolved.push({ id, content: finalText });
    }
    const serverCards = await fetchJSON(API + '/cards');
    for (const r of resolved) {
      const idx = serverCards.findIndex(c => c.id === r.id);
      if (idx >= 0) serverCards[idx].content = r.content;
    }
    setSaveStatus('saving.');
    const resp = await fetch(API + '/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(serverCards)
    });
    if (resp.ok) {
      modal.classList.add('hidden');
      setSaveStatus('saved');
      setTimeout(loadCards, 250);
    } else {
      alert('Failed to apply resolutions.');
      setSaveStatus('error');
    }
  };

  document.getElementById('dismissConflicts').onclick = () => {
    modal.classList.add('hidden');
  };
}

/* ---------- Event wiring ---------- */

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadCards();
});

document.getElementById('newCardBtn').addEventListener('click', async () => {
  const existing = await fetchJSON(API + '/cards');
  if ((existing || []).length >= CARD_LIMIT) {
    alert(`Card limit reached (${CARD_LIMIT}).`);
    updateNewCardBtnState(existing.length);
    return;
  }
  const nextId = idFromIndex(existing || []);
  const newCard = {
    id: nextId,
    title: 'New Card',
    type: 'note',
    content: '',
    tags: [],
    meta: { version: 1, updatedAt: Date.now() }
  };
  const container = document.getElementById('cardsColumn');
  const el = createCardDOM(newCard);
  container.appendChild(el);
  drawConnections();
  await saveAllCards();
});

document.getElementById('applyStory').addEventListener('click', async () => {
  const text = document.getElementById('storyText').value;
  await fetch(API + '/story', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text })
  });
  setTimeout(loadCards, 300);
});

document.getElementById('searchMem').addEventListener('input', debounce(async (e) => {
  const q = e.target.value;
  if (!q) { document.getElementById('memResults').innerHTML = ''; return; }
  const res = await fetchJSON(API + '/mem/search?q=' + encodeURIComponent(q) + '&top=6');
  const cont = document.getElementById('memResults');
  cont.innerHTML = '';
  (res || []).forEach(r => {
    const div = document.createElement('div');
    div.className = 'mem-item';
    const score = typeof r.score === 'number' ? r.score.toFixed(3) : '0.000';
    const text = (r.text || '').slice(0, 200);
    div.innerHTML = `<strong>${score}</strong> — ${text}`;
    cont.appendChild(div);
  });
}, 300));

const connectBtn = document.getElementById('connectModeBtn');
if (connectBtn) {
  connectBtn.addEventListener('click', () => {
    setConnectMode(!connectMode);
  });
}

const regridBtn = document.getElementById('regridBtn');
if (regridBtn) {
  regridBtn.addEventListener('click', () => {
    const col = document.getElementById('cardsColumn');
    Array.from(col.children).forEach(card => { card.style.order = ''; });
    setSaveStatus('regridded');
    requestAnimationFrame(drawConnections);
  });
}

/* ---------- Initial boot ---------- */

window.addEventListener('DOMContentLoaded', () => {
  loadConnectionsFromStorage();
  initVizTabs();
  loadCards();

  // autosave story
  const storyArea = document.getElementById('storyText');
  storyArea.addEventListener('input', debounce(async () => {
    await fetch(API + '/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: storyArea.value })
    });
  }, 500));

  // keep lines + views in sync on resize
  window.addEventListener('resize', debounce(() => {
    drawConnections();
    buildMindmapView(latestCards);
    buildBeamView(latestCards);
  }, 120));
});
