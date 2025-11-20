# Story Sync — VS Code Extension (Prototype)

> ⚡ Real-time storytelling workflow sync between VS Code, a backend engine, and a visual card-based UI.

Story Sync is a lightweight VS Code extension designed for writers, developers, and narrative designers who want a **live connection** between their text files and a structured story-building system.

This extension notifies the local Story Sync backend whenever key files change — keeping your **story.txt**, **story_outline.txt**, **index.json**, and UI cards in perfect sync.

---

<p align="center">
  <img src="https://raw.githubusercontent.com/your/repo/main/images/cover.png" width="700">
</p>

> *(Replace with your screenshot — Marketplace README supports image URLs only)*

---

## ✨ Features

### 🔄 Live File Sync  
Automatically detects changes in:

- `data/story.txt`
- `data/story_outline.txt`
- `data/index.json`
- `frontend/index.html`

Whenever these files are modified, the extension sends a lightweight POST request to the backend:

