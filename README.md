# Chimera Story Sync Prototype

A lightweight end-to-end story development workflow:

* **story.txt** → Writer’s freeform text
* **index cards UI (index.html)** → Visual card editor
* **story_outline.txt + index.json** → Structured backbone format
* **mem0** → AI-powered memory layer with embeddings
* **VS Code Extension** → Watches story files & notifies backend
* **Node.js Backend** → Handles syncing & memory creation

This project demonstrates a hybrid system where freeform writing, structured outlines, and visual index cards remain fully synchronized.

---

## ✨ Features

### 🔄 Live Sync Between:

* `story.txt` (plain English story)
* `story_outline.txt` (structured outline)
* `index.json` (card data)
* Frontend card UI (`index.html`)

Changes in **any** of the above automatically update the others.

---

### 🧠 AI-Powered Memory (mem0)

* Embeddings via **Xenova BERT-base** (no Python required)
* Each card’s content stored as a memory
* Memory search highlights matching cards
* 100% local — no external API

---

### 🧩 VS Code Extension

The extension continuously watches:

* `data/story.txt`
* `data/story_outline.txt`
* `data/index.json`
* `frontend/index.html`

And notifies the backend on changes.
It also adds commands:

* **Story Sync: Open Story Sync UI**
* **Story Sync: Ping Backend**
* **Story Sync: Force Sync Now**

---

# ⚙️ Installation & Setup Guide

Follow these steps to install and run Story Sync on any system.

---

## ✅ 1. Install Requirements

Ensure you have:

* Node.js 18+
* npm
* Visual Studio Code

---

## ✅ 2. Install Project Dependencies

Open a terminal inside the project root and run:

```bash
npm install express chokidar body-parser @xenova/transformers minimist ws
```

This installs:

* express — Backend server
* chokidar — File watchers
* body-parser — JSON handling
* @xenova/transformers — Local embedding model
* minimist — CLI parsing
* ws — WebSocket support

---

## ✅ 3. Install the VS Code Extension (.vsix)

You’ll find the packaged extension:

```
story-sync-prototype-0.0.1.vsix
```

To install:

1. Open VS Code
2. Press **Ctrl + Shift + P**
3. Search: **Extensions: Install from VSIX**
4. Select the `.vsix` file
5. Install → Reload VS Code

Commands now available:

* **Story Sync: Open Story Sync UI**
* **Story Sync: Ping Backend**
* **Story Sync: Force Sync Now**

---

## ✅ 4. Start the Backend Server

Run:

```bash
node backend/sync.js
```

Expected output:

```
Backend server listening at http://localhost:3456
Files watched: data/story.txt, story_outline.txt, index.json
```

### ⏳ First-time load

The AI model loads locally the first time → **10–20 seconds**.
After that, startup becomes instant.

---

## ✅ 5. Open the Writer UI

Go to:

```
http://localhost:3456
```

You will see:

* Card editor
* Story text panel
* Memory search
* Sync indicators

---

# 🚀 Usage Guide

### ✏️ Write in `story.txt`

* Freeform writing
* Automatically split into cards

### 🎴 Edit cards via UI

* Add, edit, delete cards visually
* Auto-syncs into story + outline

### 📄 Edit `story_outline.txt`

* Structural editing
* Reflects in cards + story

### 🧠 Use Memory Search

* Enter query
* Highlights matching cards

---

# 🛠 Troubleshooting

### Command not found in VS Code

Restart VS Code after installing `.vsix`.

### Backend not responding

Run:

```bash
node backend/sync.js
```

### UI not updating

Open the **project root folder** in VS Code.

### First run is slow

Normal — embedding model loads on first startup.

---

# 📌 Quick Summary

Install dependencies:

```bash
npm install express chokidar body-parser @xenova/transformers minimist ws
```

Install VSIX:
**VS Code → Ctrl + Shift + P → Install from VSIX**

Run backend:

```bash
node backend/sync.js
```

Open UI:

```
http://localhost:3456
```

🎉 You're ready to use **Chimera Story Sync**!

---

