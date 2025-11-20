# Story Sync Prototype  
A lightweight end-to-end story development workflow:

- **story.txt** → Writer’s freeform text  
- **index cards UI (index.html)** → Visual card editor  
- **story_outline.txt + index.json** → Backbone structured format  
- **mem0** → AI memory layer with embeddings  
- **VS Code Extension** → Watches story files and notifies backend  
- **Node.js Backend** → Handles syncing & memory creation  

This project demonstrates a hybrid approach to writing workflows, where freeform writing and structured cards remain fully synchronized.

---

## ✨ Features

### 🔄 Live Sync Between:
- `story.txt` (plain English story)
- `story_outline.txt` (structured outline)
- `index.json` (card data)
- Frontend card UI (`index.html`)

Changes in one automatically propagate to the others.

---

### 🧠 AI-Powered Memory (mem0)
- Embeddings via **Xenova BERT-base** (no Python needed)
- Card content stored as memory with `ref: card_id`
- Memory search highlights corresponding card in UI

---

### 🧩 VS Code Extension
The included VS Code extension:

- Watches file changes in:
  - `data/story.txt`
  - `data/story_outline.txt`
  - `data/index.json`
  - `frontend/index.html`
- Sends a POST event to backend at:
