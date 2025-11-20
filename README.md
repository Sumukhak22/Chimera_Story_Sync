# Chimera Story Sync Prototype  
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


### 🧩 VS Code Extension
The included VS Code extension:

- Watches file changes in:
  - `data/story.txt`
  - `data/story_outline.txt`
  - `data/index.json`
  - `frontend/index.html`
- Sends a POST event to backend 

# ⚙️ Installation & Setup Guide

Follow these steps to install and run Story Sync on any system.

---

## ✅ **1. Install Requirements**

Make sure the system has:

- **Node.js 18+**  
- **npm** (comes with Node)  
- **Visual Studio Code** (for the extension)

---

## ✅ **2. Install Project Dependencies**

Open a terminal inside the **project root folder** and run:

```bash
npm install express chokidar body-parser @xenova/transformers minimist ws
```

These install:

express → Backend server
chokidar → Real-time file watchers
body-parser → JSON request handling
@xenova/transformers → Local transformer embeddings (AI model)
minimist → CLI argument handling
ws → WebSocket support (future use)

---
## ✅ **3. Install the VS Code Extension (.vsix)**

The project includes a packaged extension:
  `story-sync-prototype-0.0.1.vsix`
  
To install:

    Open VS Code
    Press Ctrl + Shift + P
Search: `Extensions: Install from VSIX`

    Select the .vsix file
    Install → Reload Window
You will now see commands such as:
`Story Sync: Open Story Sync UI`
`Story Sync: Ping Backend`
`Story Sync: Force Sync Now`

---
## ✅ **4. Install the VS Code Extension (.vsix)**

Start the Backend Server
```bash
node backend/sync.js
```
Expected output:
```bash
Backend server listening at http://localhost:3456
Files watched: data/story.txt, story_outline.txt, index.json
```

⏳ First Startup Takes Time
The first run loads the AI model locally — may take 10–20 seconds.
After this, it's fast.

---
## ✅ **5. Open the Writer UI**

In your browser:
```
http://localhost:3456
```

This loads:
  -Card Editor
  -Memory Search Panel
  -Live Sync Indicators
  -Story Text Pane


🚀 Usage Guide

✏️ Option 1 — Write in story.txt
      The backend splits paragraphs → syncs into cards.
      
🎴 Option 2 — Use the Card Editor
      Add / edit / delete cards visually → updates story + outline.
      
📄 Option 3 — Edit story_outline.txt
      Structured edits update cards + story.
      
🧠 Use Memory Search
      Type in the memory search panel → matching cards highlight immediately.

---

📌 Quick Summary

Install dependencies:
```bash
npm install express chokidar body-parser @xenova/transformers minimist ws
```

Install VSIX:
    VS Code → Ctrl+Shift+P → Install from VSIX
    
Run backend:
    ```bash
    node backend/sync.js```
    
Open UI:
    `http://localhost:3456`
