// ═══════════════════════════════════════════════════════════
// CENTRALITY METRICS
// Degree · PageRank (weighted) · Betweenness (Brandes) · Closeness (harmonic)
// ═══════════════════════════════════════════════════════════
import { PR_W } from '../config.js';

/**
 * Compute all centrality metrics for the given nodes/links.
 * Returns an object with typed arrays and the adjacency structures
 * needed by other modules.
 */
export function computeCentrality(nodes, links) {
  const N = nodes.length;
  if (N === 0) return null;

  const idxOf = Object.fromEntries(nodes.map((n, i) => [n.id, i]));

  // ── Adjacency ──────────────────────────────────────────────────────
  const adjOut = Array.from({length: N}, () => []); // directed: i → [{j, type}]
  const adjU   = Array.from({length: N}, () => []); // undirected: i ↔ [{j, type}]
  const inDeg  = new Float64Array(N);
  const outDeg = new Float64Array(N);

  links.forEach(l => {
    const i = idxOf[l.s ?? l.source?.id ?? l.source];
    const j = idxOf[l.t ?? l.target?.id ?? l.target];
    if (i === undefined || j === undefined || i === j) return;
    adjOut[i].push({j, type: l.type});
    adjU[i].push({j, type: l.type});
    adjU[j].push({j: i, type: l.type});
    outDeg[i]++;
    inDeg[j]++;
  });
  const deg = inDeg.map((v, i) => v + outDeg[i]);

  // ── PageRank (edge-type weighted, 80 iterations) ───────────────────
  const DAMP = 0.85;
  const outStrength = new Float64Array(N);
  links.forEach(l => {
    const i = idxOf[l.s ?? l.source?.id ?? l.source];
    if (i !== undefined) outStrength[i] += (PR_W[l.type] || 0.5);
  });
  let pr = new Float64Array(N).fill(1 / N);
  for (let it = 0; it < 80; it++) {
    const nxt = new Float64Array(N).fill((1 - DAMP) / N);
    links.forEach(l => {
      const i = idxOf[l.s ?? l.source?.id ?? l.source];
      const j = idxOf[l.t ?? l.target?.id ?? l.target];
      if (i === undefined || j === undefined) return;
      const w = PR_W[l.type] || 0.5;
      nxt[j] += DAMP * pr[i] * w / (outStrength[i] || 1);
    });
    pr = nxt;
  }

  // ── Betweenness centrality (Brandes 2001, undirected) ─────────────
  const bc = new Float64Array(N);
  for (let s = 0; s < N; s++) {
    const stack = [], pred = Array.from({length: N}, () => []);
    const sigma = new Float64Array(N); sigma[s] = 1;
    const dist  = new Int32Array(N).fill(-1); dist[s] = 0;
    const Q = [s]; let qi = 0;
    while (qi < Q.length) {
      const v = Q[qi++]; stack.push(v);
      for (const {j: w} of adjU[v]) {
        if (dist[w] < 0) { Q.push(w); dist[w] = dist[v] + 1; }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    const delta = new Float64Array(N);
    while (stack.length) {
      const w = stack.pop();
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) bc[w] += delta[w];
    }
  }
  const bcNorm = (N - 1) * (N - 2) || 1;
  for (let i = 0; i < N; i++) bc[i] /= bcNorm;

  // ── Closeness centrality (harmonic, undirected BFS) ────────────────
  const cl = new Float64Array(N);
  for (let s = 0; s < N; s++) {
    const dist = new Int32Array(N).fill(-1); dist[s] = 0;
    const Q = [s]; let qi = 0;
    while (qi < Q.length) {
      const v = Q[qi++];
      for (const {j: w} of adjU[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; Q.push(w); }
      }
    }
    let h = 0;
    for (let t = 0; t < N; t++) { if (t !== s && dist[t] > 0) h += 1 / dist[t]; }
    cl[s] = h / (N - 1);
  }

  return { idxOf, adjOut, adjU, deg, pr, bc, cl };
}

/** Normalise an array to [0,1]. Returns a plain Array. */
export function normArr(arr) {
  const max = Array.from(arr).reduce((m, v) => v > m ? v : m, 0);
  return max > 0 ? Array.from(arr, v => v / max) : Array.from(arr, () => 0);
}
