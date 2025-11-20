// backend/parsers.js
const CARD_START = /^--CARD_START id:(.+)$/;
const CARD_END = /^--CARD_END$/;
const META_TYPE = /^Type:\s*(.*)$/i;
const META_TITLE = /^Title:\s*(.*)$/i;
const META_CONTENT_HEADER = /^Content:\s*$/i;
const { randomUUID } = require('crypto');

function parseStoryOutline(text) {
  const lines = text.split(/\r?\n/);
  const cards = [];
  let i = 0;
  while (i < lines.length) {
    const startMatch = (lines[i] || '').match(CARD_START);
    if (startMatch) {
      const id = startMatch[1].trim();
      i++;
      let type = '', title = '', content = '';
      while (i < lines.length && !META_CONTENT_HEADER.test(lines[i])) {
        const t = lines[i];
        const mType = t.match(META_TYPE);
        const mTitle = t.match(META_TITLE);
        if (mType) type = mType[1].trim();
        if (mTitle) title = mTitle[1].trim();
        i++;
      }
      if (i < lines.length && META_CONTENT_HEADER.test(lines[i])) i++;
      const contentLines = [];
      while (i < lines.length && !CARD_END.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && CARD_END.test(lines[i])) i++;
      content = contentLines.join('\n').trim();
      cards.push({ id, type, title, content, tags: [], meta: { version: 1, updatedAt: Date.now() } });
    } else {
      i++;
    }
  }
  return cards;
}

function buildStoryOutlineFromCards(cards) {
  return cards.map(c => {
    return [
      `--CARD_START id:${c.id}`,
      `Type: ${c.type || ''}`,
      `Title: ${c.title || ''}`,
      `Content:`,
      c.content ? c.content : '',
      `--CARD_END`,
      ''
    ].join('\n');
  }).join('\n');
}

function storyTextToCards(storyText) {
  const parts = storyText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const cards = parts.map((p, idx) => ({
    id: randomUUID(),
    type: 'scene',
    title: `Paragraph ${idx+1}`,
    content: p,
    tags: [],
    meta: { version: 1, updatedAt: Date.now() }
  }));
  return cards;
}

function mergeFromStoryOutline(storyCards, jsonCards) {
  const mapJSON = new Map(jsonCards.map(c => [c.id, c]));
  const result = [];
  for (const s of storyCards) {
    if (mapJSON.has(s.id)) {
      const j = mapJSON.get(s.id);
      result.push({
        id: s.id,
        type: s.type || j.type || '',
        title: s.title || j.title || '',
        content: s.content || j.content || '',
        tags: j.tags || [],
        meta: j.meta || s.meta || { version: 1, updatedAt: Date.now() }
      });
      mapJSON.delete(s.id);
    } else {
      result.push({
        id: s.id,
        type: s.type || 'unknown',
        title: s.title || '',
        content: s.content || '',
        tags: [],
        meta: s.meta || { version: 1, updatedAt: Date.now() }
      });
    }
  }
  for (const [_, j] of mapJSON) {
    result.push(j);
  }
  return result;
}

function mergeFromJSON(jsonCards, storyCards) {
  const mapStory = new Map(storyCards.map(c => [c.id, c]));
  const result = [];
  for (const j of jsonCards) {
    if (mapStory.has(j.id)) {
      const s = mapStory.get(j.id);
      result.push({
        id: j.id,
        type: j.type || s.type || '',
        title: j.title || s.title || '',
        content: j.content || s.content || '',
        tags: j.tags || [],
        meta: j.meta || s.meta || { version: 1, updatedAt: Date.now() }
      });
      mapStory.delete(j.id);
    } else {
      result.push(j);
    }
  }
  for (const [_, s] of mapStory) {
    result.push(s);
  }
  return result;
}

module.exports = {
  parseStoryOutline,
  buildStoryOutlineFromCards,
  storyTextToCards,
  mergeFromStoryOutline,
  mergeFromJSON
};
