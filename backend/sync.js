// backend/sync.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const bodyParser = require('body-parser');

const { parseStoryOutline, buildStoryOutlineFromCards, storyTextToCards, mergeFromStoryOutline, mergeFromJSON } = require('./parsers');
const mem0 = require('./mem0');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORY_TXT = path.join(DATA_DIR, 'story.txt');
const STORY_OUTLINE = path.join(DATA_DIR, 'story_outline.txt');
const INDEX_JSON = path.join(DATA_DIR, 'index.json');
const MEM_FILE = path.join(DATA_DIR, 'mem0.json');

const CARD_LIMIT = 100;

async function ensureFile(file) {
  await fs.mkdir(path.dirname(file), { recursive: true }).catch(()=>{});
  try {
    await fs.access(file);
  } catch(e) {
    await fs.writeFile(file, '', 'utf8');
  }
}

async function readJSONSafe(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

async function writeJSON(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true }).catch(()=>{});
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

let writingLock = false;
let debounceTimer = null;

async function initialSync() {
  const storyOutlineText = await fs.readFile(STORY_OUTLINE, 'utf8').catch(()=> '');
  const storyCards = parseStoryOutline(storyOutlineText);
  const jsonCards = await readJSONSafe(INDEX_JSON);
  const storyText = await fs.readFile(STORY_TXT, 'utf8').catch(()=> '');

  if (storyCards.length === 0 && jsonCards.length === 0 && (storyText.trim() === '')) {
    const sample = [{
      id: 'card_001',
      type: 'scene',
      title: 'Example Opening',
      content: 'This is a sample paragraph. Replace me.',
      tags: [],
      meta: { version: 1, updatedAt: Date.now() }
    }];
    await writeJSON(INDEX_JSON, sample);
    await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(sample), 'utf8');
    await fs.writeFile(STORY_TXT, sample.map(s => s.content).join("\n\n"), 'utf8');
    await mem0.addMemories(sample.map(s => ({ text: s.content, source: 'init', tags: s.tags })));
    console.log('Initialized sample data.');
    return;
  }

  if (storyCards.length === 0 && jsonCards.length === 0 && storyText.trim()) {
    const cards = storyTextToCards(storyText).map((c,i)=>{
      // convert uuid -> short id
      return { ...c, id: `card_${String(i+1).padStart(3,'0')}`, meta: { version: 1, updatedAt: Date.now() } };
    });
    await writeJSON(INDEX_JSON, cards);
    await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(cards), 'utf8');
    await mem0.addMemories(cards.map(c => ({ text: c.content, source: 'story_txt', tags: c.tags })));
    console.log('Converted story.txt -> structured cards.');
    return;
  }

  const mergedToJSON = mergeFromStoryOutline(storyCards, jsonCards);
  await writeJSON(INDEX_JSON, mergedToJSON);
  await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(mergedToJSON), 'utf8');
  await fs.writeFile(STORY_TXT, mergedToJSON.map(c => c.content).join("\n\n"), 'utf8');

  await mem0.addMemories(mergedToJSON.map(c => ({ text: c.content, source: 'init', tags: c.tags })));
  console.log('Initial sync complete.');
}

async function handleStoryOutlineChange() {
  if (writingLock) return;
  const text = await fs.readFile(STORY_OUTLINE, 'utf8').catch(()=>'' );
  const storyCards = parseStoryOutline(text);
  const jsonCards = await readJSONSafe(INDEX_JSON);
  const merged = mergeFromStoryOutline(storyCards, jsonCards);
  writingLock = true;
  await writeJSON(INDEX_JSON, merged);
  await fs.writeFile(STORY_TXT, merged.map(c => c.content).join("\n\n"), 'utf8');
  await mem0.addMemories(merged.map(c => ({ text: c.content, source: 'outline_change', tags: c.tags })));
  setTimeout(()=> writingLock = false, 80);
  console.log('[sync] outline -> json/story updated');
}

async function handleIndexJsonChange() {
  if (writingLock) return;
  const jsonCards = await readJSONSafe(INDEX_JSON);
  const outlineText = await fs.readFile(STORY_OUTLINE, 'utf8').catch(()=>'' );
  const storyCards = parseStoryOutline(outlineText);
  const merged = mergeFromJSON(jsonCards, storyCards);
  writingLock = true;
  await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(merged), 'utf8');
  await fs.writeFile(STORY_TXT, merged.map(c => c.content).join("\n\n"), 'utf8');
  await mem0.addMemories(merged.map(c => ({ text: c.content, source: 'json_change', tags: c.tags })));
  setTimeout(()=> writingLock = false, 80);
  console.log('[sync] json -> outline/story updated');
}

async function handleStoryTxtChange() {
  if (writingLock) return;
  const storyText = await fs.readFile(STORY_TXT, 'utf8').catch(()=>'' );
  const cardsFromText = storyTextToCards(storyText).map((c,i)=> ({ ...c, id: `card_${String(i+1).padStart(3,'0')}` }));
  const jsonCards = await readJSONSafe(INDEX_JSON);
  const merged = mergeFromJSON(jsonCards, cardsFromText);
  writingLock = true;
  await writeJSON(INDEX_JSON, merged);
  await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(merged), 'utf8');
  await mem0.addMemories(merged.map(c => ({ text: c.content, source: 'story_txt_change', tags: c.tags })));
  setTimeout(()=> writingLock = false, 80);
  console.log('[sync] story.txt -> json/outline updated');
}

async function startServer(port = 3456) {
  await ensureFile(STORY_OUTLINE);
  await ensureFile(INDEX_JSON);
  await ensureFile(STORY_TXT);
  await ensureFile(MEM_FILE);

  await initialSync();

  const app = express();
  // increase body limit to avoid PayloadTooLargeError
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  // GET cards
  app.get('/api/cards', async (req, res) => {
    const cards = await readJSONSafe(INDEX_JSON);
    res.json(cards);
  });

  // POST cards (save/update). Performs conflict detection.
  // Client should include card.meta.updatedAt for conflict checks.
  app.post('/api/cards', async (req, res) => {
    try {
      const incoming = req.body || [];
      if (!Array.isArray(incoming)) return res.status(400).json({ ok:false, error: 'Invalid payload' });

      // enforce card limit
      if (incoming.length > CARD_LIMIT) {
        return res.status(400).json({ ok:false, error: `Card limit exceeded (${CARD_LIMIT}).` });
      }

      const current = await readJSONSafe(INDEX_JSON);
      const currentMap = new Map(current.map(c => [c.id, c]));

      const conflicts = [];

      // detect conflicts: if current updatedAt > incoming meta.updatedAt => conflict
      for (const inc of incoming) {
        const cur = currentMap.get(inc.id);
        if (cur && cur.meta && inc.meta) {
          if (cur.meta.updatedAt > inc.meta.updatedAt + 5) { // small tolerance
            conflicts.push({
              id: inc.id,
              server: cur,
              incoming: inc
            });
          }
        }
      }

      if (conflicts.length > 0) {
        return res.status(409).json({ ok:false, conflicts });
      }

      // no conflicts -> increment versions and set updatedAt
      const now = Date.now();
      const out = incoming.map(c => {
        const meta = c.meta || { version: 1, updatedAt: now };
        meta.version = (meta.version || 1) + 1;
        meta.updatedAt = now;
        return { ...c, meta };
      });

      await writeJSON(INDEX_JSON, out);
      await fs.writeFile(STORY_OUTLINE, buildStoryOutlineFromCards(out), 'utf8');
      await fs.writeFile(STORY_TXT, out.map(c => c.content).join("\n\n"), 'utf8');
      await mem0.addMemories(out.map(c => ({ text: c.content, source: 'ui_save', tags: c.tags || [] })));

      res.json({ ok: true });
    } catch (e) {
      console.error('Error /api/cards', e);
      res.status(500).json({ ok:false, error: e.message });
    }
  });

  // story endpoints
  app.get('/api/story', async (req, res) => {
    const s = await fs.readFile(STORY_TXT, 'utf8').catch(()=>'' );
    res.json({ text: s });
  });

  app.post('/api/story', async (req, res) => {
    const { text } = req.body;
    if (typeof text !== 'string') return res.status(400).json({ ok:false });
    await fs.writeFile(STORY_TXT, text, 'utf8');
    await handleStoryTxtChange();
    res.json({ ok:true });
  });

  // mem endpoints
  app.post('/api/mem/add', async (req,res) => {
    const { text, source, tags } = req.body;
    if (!text) return res.status(400).json({ ok:false });
    const item = await mem0.addMemory({ text, source, tags });
    res.json(item);
  });

  app.post('/api/mem/addBatch', async (req,res) => {
    const items = req.body.items || [];
    await mem0.addMemories(items);
    res.json({ ok:true, added: items.length });
  });

  app.get('/api/mem/search', async (req,res) => {
    const q = (req.query.q || '').toString();
    const top = parseInt(req.query.top || '5', 10);
    const results = await mem0.searchMem(q, top);
    res.json(results);
  });

  // endpoint used by VS Code extension to notify backend quickly
  app.post('/__vscode_notify', (req, res) => {
    console.log('[vscode_notify]', req.body);
    res.json({ ok:true });
  });

  // watcher
  const watcher = chokidar.watch([STORY_OUTLINE, INDEX_JSON, STORY_TXT], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {pollInterval: 50, stabilityThreshold: 120}
  });

  watcher.on('all', (event, filepath) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (writingLock) return;
      const base = path.basename(filepath);
      try {
        if (base === path.basename(STORY_OUTLINE)) {
          await handleStoryOutlineChange();
        } else if (base === path.basename(INDEX_JSON)) {
          await handleIndexJsonChange();
        } else if (base === path.basename(STORY_TXT)) {
          await handleStoryTxtChange();
        }
      } catch (e) {
        console.error('Error during watch handler:', e);
      }
    }, 80);
  });

  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
    console.log('Files watched: ', STORY_OUTLINE, INDEX_JSON, STORY_TXT);
  });
}

if (require.main === module) {
  startServer().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { startServer };
