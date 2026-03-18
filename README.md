# OCH·KG — Oliver C. Hirst Research Knowledge Graph

Interactive knowledge graph for exploring Oliver C. Hirst’s research ecosystem, adjacent literature, and AI-inferred conceptual links.

Built as a fast, static, browser-first app with D3.js, modular ES modules, and mobile-optimized panel interactions.

---

## Highlights

- **Interactive graph exploration**
  - Zoom/pan/drag with D3 force simulation
  - Hover tooltips for nodes and links
  - Click-to-focus and detail inspection
- **Research ranking views**
  - Overall, EQBSL, PageRank, Degree, Betweenness, Closeness
- **AI graph assistant (OpenRouter)**
  - Natural language graph actions (highlight, path finding, focus, inferred edges)
  - Free-model discovery via OpenRouter models API
- **Dynamic graph enrichment**
  - Add papers from DOI / arXiv / Zenodo input
  - Fetch adjacent papers from Semantic Scholar
- **Command palette (`Cmd/Ctrl + K`)**
  - Fast action/search interface
- **Mobile-first panel UX**
  - Bottom-sheet behavior
  - Touch targets, drag handles, scroll lock, safe-area aware layout
- **Theme support**
  - Dark + light modes with persistent preference

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
- **Filters:** use top pills (scope/domain/source)
- **Chat:** open `💬 Chat`, ask natural language graph queries
- **Rankings:** open `📊 Ranks` and switch metric tabs
- **Theme:** toggle with `🌙 / ☀️`
- **Command palette:** `Cmd/Ctrl + K`

---

## Deployment Notes

This is a static app. Build step is not required.

1. Push repository
2. Point static host at repo root
3. Publish `index.html` + `styles/` + `src/`

---

## Roadmap Ideas

- Move API key out of client bundle
- Add snapshot/export for graph state
- Add richer graph legends and edge provenance inspector
- Add tests for panel state transitions and mobile interactions

---

## License

No license file is currently included. Add one if you intend public reuse.
