// ═══════════════════════════════════════════════════════════
// SEMANTIC SCHOLAR API
// Fetch adjacent works, citation networks, and paper metadata
// ═══════════════════════════════════════════════════════════

const S2_BASE = 'https://api.semanticscholar.org/graph/v1';
const S2_FIELDS = 'paperId,title,abstract,authors,year,citationCount,references,citations,fieldsOfStudy,externalIds';

/**
 * Fetch full metadata + reference list for a paper by DOI or arXiv ID.
 *
 * @param {string} identifier  - DOI (10.xxx/yyy), arXiv ID (2301.00000), or S2 paperId
 * @returns {Promise<S2Paper|null>}
 */
export async function fetchS2Paper(identifier) {
  try {
    // Resolve identifier to S2 format
    let s2id;
    if (/^10\.\d{4,}\//.test(identifier)) {
      s2id = `DOI:${identifier}`;
    } else if (/^\d{4}\.\d{4,5}$/.test(identifier.replace(/v\d+$/, ''))) {
      s2id = `ARXIV:${identifier.replace(/v\d+$/, '')}`;
    } else {
      s2id = identifier; // assume S2 paperId
    }

    const r = await fetch(`${S2_BASE}/paper/${encodeURIComponent(s2id)}?fields=${S2_FIELDS}`);
    if (!r.ok) return null;
    const data = await r.json();
    return normaliseS2Paper(data);
  } catch(e) {
    return null;
  }
}

/**
 * Fetch papers that cite a given paper — useful for finding
 * "what has this work influenced?"
 */
export async function fetchS2Citations(paperId, limit = 20) {
  try {
    const r = await fetch(
      `${S2_BASE}/paper/${paperId}/citations?fields=paperId,title,abstract,authors,year,externalIds&limit=${limit}`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map(item => normaliseS2Paper(item.citingPaper)).filter(Boolean);
  } catch(e) {
    return [];
  }
}

/**
 * Fetch the reference list of a paper — what it builds on.
 */
export async function fetchS2References(paperId, limit = 30) {
  try {
    const r = await fetch(
      `${S2_BASE}/paper/${paperId}/references?fields=paperId,title,abstract,authors,year,externalIds&limit=${limit}`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map(item => normaliseS2Paper(item.citedPaper)).filter(Boolean);
  } catch(e) {
    return [];
  }
}

/**
 * Search for papers by keyword query — used for research agent discovery.
 */
export async function searchS2(query, limit = 10) {
  try {
    const r = await fetch(
      `${S2_BASE}/paper/search?query=${encodeURIComponent(query)}&fields=paperId,title,abstract,authors,year,externalIds&limit=${limit}`
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map(normaliseS2Paper).filter(Boolean);
  } catch(e) {
    return [];
  }
}

/**
 * Autonomous research agent: given a set of seed node IDs in the current graph,
 * fetch their S2 neighbours and return candidate papers to import,
 * scored by relevance to the existing graph.
 *
 * @param {Array}    seedNodes  - nodes to expand from (e.g. selected cluster)
 * @param {Object}   nmap       - existing node map for duplicate filtering
 * @param {number}   budget     - max API calls
 * @returns {Promise<Array>}    - scored candidates [{paper, score, reason}, ...]
 */
export async function fetchAdjacentWork(seedNodes, nmap, budget = 10) {
  const candidates = new Map(); // S2 paperId → {paper, score, sources}
  let calls = 0;

  for (const node of seedNodes) {
    if (calls >= budget) break;
    const doi  = node.doi;
    const axId = node.id?.startsWith('ax_') ? node.url?.match(/(\d{4}\.\d{4,5})/)?.[1] : null;
    const identifier = doi || axId;
    if (!identifier) continue;

    calls++;
    const s2paper = await fetchS2Paper(identifier);
    if (!s2paper) continue;

    // Fetch references (what this paper cites)
    if (calls < budget) {
      calls++;
      const refs = await fetchS2References(s2paper.s2id, 15);
      refs.forEach(ref => {
        if (!ref || isDuplicate(ref, nmap)) return;
        const existing = candidates.get(ref.s2id) || { paper:ref, score:0, sources:[] };
        existing.score += 1;
        existing.sources.push({ node:node.id, relation:'reference' });
        candidates.set(ref.s2id, existing);
      });
    }

    // Fetch citations (what cites this paper)
    if (calls < budget) {
      calls++;
      const cites = await fetchS2Citations(s2paper.s2id, 10);
      cites.forEach(cite => {
        if (!cite || isDuplicate(cite, nmap)) return;
        const existing = candidates.get(cite.s2id) || { paper:cite, score:0, sources:[] };
        existing.score += 0.8; // slightly lower than direct references
        existing.sources.push({ node:node.id, relation:'citation' });
        candidates.set(cite.s2id, existing);
      });
    }

    await _sleep(300); // respect rate limit (100 req/s unauth, but be polite)
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

// ── Normalisation ──────────────────────────────────────────────────────────
function normaliseS2Paper(raw) {
  if (!raw || !raw.paperId) return null;
  const doi    = raw.externalIds?.DOI || null;
  const arxiv  = raw.externalIds?.ArXiv || null;
  return {
    s2id:     raw.paperId,
    title:    raw.title || 'Unknown',
    abstract: (raw.abstract || '').slice(0, 500),
    authors:  (raw.authors || []).map(a => a.name).slice(0, 4),
    year:     raw.year || 2024,
    doi,
    url:      doi ? `https://doi.org/${doi}` : arxiv ? `https://arxiv.org/abs/${arxiv}` : `https://www.semanticscholar.org/paper/${raw.paperId}`,
    src:      arxiv ? 'arXiv' : doi ? 'external' : 'Semantic Scholar',
    tags:     (raw.fieldsOfStudy || []).slice(0, 4),
    citationCount: raw.citationCount || 0,
  };
}

function isDuplicate(paper, nmap) {
  if (!paper) return true;
  // Check by DOI
  if (paper.doi && Object.values(nmap).some(n => n.doi === paper.doi)) return true;
  // Check by title similarity (naive)
  const title = paper.title?.toLowerCase() || '';
  return Object.values(nmap).some(n =>
    n.title && n.title.toLowerCase() === title
  );
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
