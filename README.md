# OCH·KG — Oliver C. Hirst Research Knowledge Graph

An interactive argument map of ideas: Oliver C. Hirst’s research core, surrounding literature, and machine-inferred conceptual bridges.

This is not a static bibliography dressed up as a graph. It is a live, inspectable system for asking better questions: What connects to what? Which claims carry structural weight? Where are the weak ties, the hidden paths, the conceptual fault lines?

Built as a fast, static, browser-first app with D3.js, modular ES modules, and hard-earned mobile UX refinements.

---

## Highlights

- **Graph exploration with teeth**
  - Zoom/pan/drag via D3 force simulation
  - Hover tooltips for node/link semantics
  - Click-to-focus and detail inspection without context loss
- **Ranking views that matter**
  - Overall, EQBSL, PageRank, Degree, Betweenness, Closeness
- **AI assistant that acts on the graph, not around it**
  - Natural-language graph actions (highlight, path finding, focus, inferred edges)
  - Free-model discovery from OpenRouter’s models API
- **Live graph enrichment**
  - Add papers from DOI / arXiv / Zenodo input
  - Pull adjacent research from Semantic Scholar
- **Command palette (`Cmd/Ctrl + K`)**
  - Action launcher + graph-aware search
- **Mobile UX that behaves like it belongs in 2026**
  - Bottom-sheet panels, drag handles, safe-area awareness
  - scroll-lock, touch targets, and keyboard-aware chat behavior
- **Theme support**
  - Dark + light modes with persisted preference

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES modules)
- **Visualization:** D3.js (`7.8.5`, CDN)
- **Styling:** Modular CSS (`base.css`, `graph.css`, `panels.css`)
- **Dev server:** BrowserSync
- **Deployment:** Any static host (Netlify/Vercel/GitHub Pages/S3)

---

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Run in development mode

```bash
npm run dev
```

Default local URL is printed by BrowserSync (typically `http://localhost:3000` or next available port).

### 3) Run static preview server

```bash
npm run start
```

---

## Configuration

Core config lives in [src/config.js](src/config.js).

Important values:

- `OPENROUTER_KEY` — OpenRouter API key used by chat/classification/edge synthesis
- `DEFAULT_MODEL` — fallback LLM model
- cluster colors, link styles, edge weights (EQBSL/PageRank)

### OpenRouter key

Current implementation uses a client-side key constant in [src/config.js](src/config.js). If you rotate keys, update that value and redeploy.

If you are deploying publicly, treat key exposure as inevitable and plan rotation accordingly.

---

## Scripts

From [package.json](package.json):

- `npm run dev` — BrowserSync server + live CSS/JS/HTML reload
- `npm run start` / `npm run serve` — static serving via `serve`

---

## Project Structure

```text
.
├── index.html
├── styles/
│   ├── base.css
│   ├── graph.css
│   └── panels.css
└── src/
    ├── main.js
    ├── config.js
    ├── ai/
    │   ├── client.js
    │   ├── classify.js
    │   ├── edges.js
    │   ├── graph-llm.js
    │   └── synthesis.js
    ├── data/
    │   ├── arxiv.js
    │   ├── cited.js
    │   ├── links.js
    │   ├── oli.js
    │   └── zenodo.js
    ├── graph/
    │   ├── interaction.js
    │   ├── render.js
    │   └── simulation.js
    ├── metrics/
    │   ├── advanced.js
    │   ├── centrality.js
    │   ├── community.js
    │   └── eqbsl.js
    ├── panels/
    │   ├── chat.js
    │   ├── detail.js
    │   └── rankings.js
    ├── sources/
    │   ├── fetch.js
    │   └── semantic-scholar.js
    └── ui/
        └── bottom-sheet.js
```

---

## Interaction Guide

- **Pan/zoom:** drag canvas, scroll/pinch to zoom
- **Node details:** click a node
- **Open paper:** double-click node (or use detail panel link)
- **Filters:** top pills for scope/domain/source slicing
- **Chat:** open `💬 Chat` and issue graph-native prompts
- **Rankings:** open `📊 Ranks`, switch metric tabs, compare structures
- **Theme:** toggle with `🌙 / ☀️`
- **Command palette:** `Cmd/Ctrl + K`

---

## Deployment Notes

This is a static app. Build step is not required.

1. Push repository
2. Point static host at repo root
3. Publish `index.html` + `styles/` + `src/`

If you can host static files, you can ship this.

---

## Roadmap Ideas

- Move API key out of client bundle
- Add snapshot/export for graph state
- Add richer graph legends and edge provenance inspector
- Add tests for panel state transitions and mobile interactions

---

## Why this exists

Because most literature maps are decorative. This one is operational.

It lets you interrogate a body of work instead of merely admiring it.

---

## License

No license file is currently included. Add one if you intend public reuse.
