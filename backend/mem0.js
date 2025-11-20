// backend/mem0.js
// FIXED: Uses dynamic import for @xenova/transformers (ESM) inside CommonJS.
// Embeddings = local BERT-base with pooling: 'mean'.

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const MEM_FILE = path.join(__dirname, '..', 'data', 'mem0.json');

// Will hold the loaded model pipeline
let embedModel = null;
let modelLoading = null;

// Dynamically import transformers (ESM)
async function loadTransformers() {
  const module = await import('@xenova/transformers');
  return module;
}

async function ensureModel() {
  if (embedModel) return embedModel;

  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    const { pipeline } = await loadTransformers();
    embedModel = await pipeline(
      'feature-extraction',
      'Xenova/bert-base-uncased', 
      { quantized: false } // quantized false = more accurate
    );
    return embedModel;
  })();

  return modelLoading;
}

async function loadMem() {
  try {
    const raw = await fs.readFile(MEM_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

async function saveMem(arr) {
  await fs.mkdir(path.dirname(MEM_FILE), { recursive: true }).catch(() => {});
  await fs.writeFile(MEM_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

function flatten(arr) {
  while (Array.isArray(arr) && Array.isArray(arr[0])) arr = arr[0];
  return arr;
}

function l2(vec) {
  const norm = Math.sqrt(vec.reduce((s,v)=>s+v*v,0)) || 1;
  return vec.map(v => v/norm);
}

async function embedText(text) {
  await ensureModel();
  const raw = await embedModel(text, { pooling: 'mean', normalize: true });
  const flattened = flatten(raw.data || raw);
  return Array.from(flattened);
}

function cosine(a, b) {
  let dot=0, na=0, nb=0;
  for (let i=0;i<Math.min(a.length,b.length);i++){
    dot += a[i]*b[i];
    na += a[i]*a[i];
    nb += b[i]*b[i];
  }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-12);
}

async function addMemory({ text, source = 'auto', tags = [] }) {
  const mem = await loadMem();
  const embedding = await embedText(text);
  const item = { id: randomUUID(), text, source, tags, embedding, created: Date.now() };
  mem.push(item);
  await saveMem(mem);
  return item;
}

async function addMemories(items) {
  const mem = await loadMem();
  for (const it of items) {
    const embedding = await embedText(it.text);
    mem.push({
      id: randomUUID(),
      text: it.text,
      source: it.source || 'auto',
      tags: it.tags || [],
      embedding,
      created: Date.now()
    });
  }
  await saveMem(mem);
  return true;
}

async function searchMem(query, topK = 5) {
  if (!query) return [];
  const mem = await loadMem();
  if (mem.length === 0) return [];
  const qvec = await embedText(query);
  const scored = mem.map(m => ({
    score: cosine(qvec, m.embedding),
    item: m
  }));
  scored.sort((a,b)=>b.score - a.score);
  return scored.slice(0, topK).map(s => ({
    id: s.item.id,
    text: s.item.text,
    score: s.score,
    tags: s.item.tags
  }));
}

module.exports = {
  addMemory,
  addMemories,
  searchMem,
  loadMem,
  saveMem,
  embedText
};
