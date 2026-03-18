// ═══════════════════════════════════════════════════════════
// COMMUNITY DETECTION — Louvain method
// Detects emergent communities from actual edge topology,
// independent of the hand-assigned cluster labels.
// ═══════════════════════════════════════════════════════════

/**
 * Run Louvain community detection on the graph.
 * Returns a Map<nodeId, communityId> and a quality score (modularity Q).
 *
 * @param {Array} nodes
 * @param {Array} links  - using s/t or source/target
 * @returns {{ communities: Map<string,number>, modularity: number, count: number }}
 */
export function detectCommunities(nodes, links) {
  const N = nodes.length;
  if (N === 0) return { communities: new Map(), modularity: 0, count: 0 };

  const ids  = nodes.map(n => n.id);
  const idx  = Object.fromEntries(ids.map((id, i) => [id, i]));

  // Build weighted adjacency (undirected, edge-type weights)
  const W = { extends:2, inherits:2, builds_on:1.5, cites:1.5, seeds:1.5,
               uses:1.2, supports:1, integrates:1.2, publishes_to:0.8, similar:0.5 };

  const adj = Array.from({length: N}, () => new Map()); // adj[i] → Map<j, weight>
  let totalWeight = 0;

  links.forEach(l => {
    const i = idx[l.s ?? l.source?.id ?? l.source];
    const j = idx[l.t ?? l.target?.id ?? l.target];
    if (i === undefined || j === undefined || i === j) return;
    const w = W[l.type] || 0.5;
    adj[i].set(j, (adj[i].get(j) || 0) + w);
    adj[j].set(i, (adj[j].get(i) || 0) + w);
    totalWeight += w;
  });
  totalWeight = totalWeight || 1;

  const ki = Array.from({length: N}, (_, i) => {
    let s = 0; for (const w of adj[i].values()) s += w; return s;
  });

  // ── Phase 1: greedy modularity optimisation ────────────────────────
  const community = Array.from({length: N}, (_, i) => i); // each node in own community

  let improved = true;
  let passes = 0;
  while (improved && passes < 20) {
    improved = false; passes++;
    // Randomise order for better results
    const order = Array.from({length: N}, (_, i) => i).sort(() => Math.random() - 0.5);
    for (const i of order) {
      const ci = community[i];
      // Compute sum of weights to each neighbour community
      const neighbourQ = new Map(); // communityId → sum of weights
      for (const [j, w] of adj[i]) {
        const cj = community[j];
        neighbourQ.set(cj, (neighbourQ.get(cj) || 0) + w);
      }
      // Current community gain (remove i from ci)
      const wi_ci = neighbourQ.get(ci) || 0;
      // Find best community to move to
      let bestGain = 0, bestC = ci;
      for (const [cj, wij] of neighbourQ) {
        if (cj === ci) continue;
        // ΔQ = [wij - wi_ci] / totalWeight - ki[i] * (kSum_cj - kSum_ci + ki[i]) / (2*m^2)
        // Simplified: modularity gain of moving i from ci to cj
        const sumCj = _communityStrength(community, ki, N, cj);
        const sumCi = _communityStrength(community, ki, N, ci) - ki[i];
        const gain = (wij - wi_ci) / totalWeight
          - ki[i] * (sumCj - sumCi) / (2 * totalWeight * totalWeight);
        if (gain > bestGain) { bestGain = gain; bestC = cj; }
      }
      if (bestC !== ci) { community[i] = bestC; improved = true; }
    }
  }

  // ── Relabel communities as 0..K-1 ─────────────────────────────────
  const labelMap = new Map();
  let nextLabel = 0;
  const result = new Map();
  ids.forEach((id, i) => {
    const c = community[i];
    if (!labelMap.has(c)) labelMap.set(c, nextLabel++);
    result.set(id, labelMap.get(c));
  });

  // ── Compute modularity Q ───────────────────────────────────────────
  let Q = 0;
  for (let i = 0; i < N; i++) {
    for (const [j, wij] of adj[i]) {
      if (community[i] === community[j]) {
        Q += wij - (ki[i] * ki[j]) / (2 * totalWeight);
      }
    }
  }
  Q /= (2 * totalWeight);

  return { communities: result, modularity: Q, count: nextLabel };
}

function _communityStrength(community, ki, N, targetC) {
  let s = 0;
  for (let i = 0; i < N; i++) if (community[i] === targetC) s += ki[i];
  return s;
}

/**
 * Compute homophily coefficient: fraction of edges that connect same-cluster nodes.
 * A value close to 1 means the graph is highly siloed by cluster label.
 */
export function computeHomophily(nodes, links, nmap) {
  let sameCluster = 0, total = 0;
  links.forEach(l => {
    const s = nmap[l.s ?? l.source?.id ?? l.source];
    const t = nmap[l.t ?? l.target?.id ?? l.target];
    if (!s || !t) return;
    total++;
    if (s.cluster === t.cluster) sameCluster++;
  });
  return total > 0 ? sameCluster / total : 0;
}
