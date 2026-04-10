# Claude Development Rules

## 🎯 Goal

Generate clean, production-ready backend code for automation systems.

---

## 🧠 Coding Principles

* Write modular code (no monolith files)
* Use clear naming conventions
* Separate logic into:

  * controllers
  * services
  * utils

---

## ⚙️ Backend Rules

* Use async/await (no callbacks)
* Handle errors properly (try/catch)
* Never crash on API failure
* Add logs for debugging

---

## 💬 AI Integration Rules

* Always enforce JSON output
* Validate response before using
* Handle invalid AI responses safely

---

## 📊 Google Sheets Rules

* Do not overwrite data
* Always append rows
* Ensure correct column mapping

---

## 🔐 Environment Rules

* Use .env for:

  * API keys
  * tokens
  * sheet IDs

---

## 🧩 Conversation Logic Rules

* Maintain per-user state
* Never lose context
* Ask only missing fields
* Confirm before saving

---

## 🚫 Avoid

* Hardcoding values
* Repeating logic
* Mixing business logic with routes
* Unstructured code

---

## ✅ Always

* Keep code readable
* Add comments where needed
* Make system scalable


