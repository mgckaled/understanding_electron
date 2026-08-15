# crivo — UI kit

Recreation of the real conversational shell (`src/renderer/src/app/` + `src/renderer/src/features/conversation/` + `src/renderer/src/features/settings/` in `mgckaled/understanding_electron`). Cosmetic-only: local state, no Ollama/IPC calls, no persistence.

## What's here
- `index.html` — mounts the whole shell: sidebar (new conversation, conversation list, open-dataset panel, footer), conversation view (header + model selector + thread + composer with a context-budget meter), and the Settings dialog (CPU threads + loaded models).
- `Sidebar.jsx`, `ConversationView.jsx`, `SettingsDialog.jsx` — the three screen-level pieces, composed from `components/core/*`.

## Deliberately not built here
Dataset pipeline, SQL/steps proposals, document/image attachments, receipts, charts — not implemented in the real app yet (see its `docs/ROADMAP.md`). This kit only recreates what already ships.
