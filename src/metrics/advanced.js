// ═══════════════════════════════════════════════════════════
// ADVANCED GRAPH METRICS
// Structural holes (Burt constraint) · Ego-network density
// Link prediction (Jaccard · Adamic-Adar · Resource Allocation)
// ═══════════════════════════════════════════════════════════

/**
 * Compute Burt's constraint for every node.
 * Nodes with LOW constraint sit between disconnected clusters (structural holes).
 * These are the nodes doing the most intellectual synthesis work.
 *
 * C_i = Σ_j (p_ij + Σ_q p_iq * p_qj)^2
 *
 * Returns Map<nodeId, constraint> — values in [0,1].
 */
export function computeBurtConstraint(nodes, links, nmap) {
  const N = nodes.length;
  if (N === 0) return new Map();

  // Build undirected weighted adjacency
  const W = { extends:2, inherits:2, builds_on:1.5, cites:1.5, seeds:1.5,
               uses:1.2, supports:1, integrates:1.2, publishes_to:0.8, similar:0.5 };
  const adj = new Map(); // nodeId → Map<neighbourId, weight>
  nodes.forEach(n => adj.set(n.id, new Map()));

  links.forEach(l => {
    const s = l.s ?? l.source?.id ?? l.source;
    const t = l.t ?? l.target?.id ?? l.target;
    if (!nmap[s] || !nmap[t] || s === t) return;
    const w = W[l.type] || 0.5;
    adj.get(s).set(t, (adj.get(s).get(t) || 0) + w);
    adj.get(t).set(s, (adj.get(t).get(s) || 0) + w);
  });

  const result = new Map();
  nodes.forEach(n => {
    const neighbours = adj.get(n.id);
    if (!neighbours || neighbours.size === 0) { result.set(n.id, 1); return; }

    // p_ij = w_ij / Σ_k w_ik  (normalised tie strength)
    const totalStrength = Array.from(neighbours.values()).reduce((s, v) => s + v, 0) || 1;
    const p = new Map();
    for (const [j, w] of neighbours) p.set(j, w / totalStrength);

    // Constraint
    let C = 0;
    for (const [j, pij] of p) {
      let indirect = 0;
      // Σ_q p_iq * p_qj  (indirect investment through mutual contacts)
      for (const [q, piq] of p) {
        if (q === j) continue;
        const qAdj = adj.get(q);
        const pqj = qAdj ? (qAdj.get(j) || 0) / (Array.from(qAdj.values()).reduce((s,v)=>s+v,0)||1) : 0;
        indirect += piq * pqj;
      }
      C += Math.pow(pij + indirect, 2);
    }
    result.set(n.id, Math.min(C, 1));
  });
  return result;
}

/**
 * Compute ego-network density for every node.
 * = fraction of possible edges among the node's neighbours that actually exist.
 * High density = tight school of thought.
 * Low density = bridge node spanning disconnected communities.
 *
 * Returns Map<nodeId, density> — values in [0,1].
 */
export function computoEgoDensity(nodes, links, nmap) {
  // Build undirected neighbour sets
  const neighbours = new Map();
  nodes.forEach(n => neighbours.set(n.id, new Set()));
  links.forEach(l => {
    const s = l.s ?? l.source?.id ?? l.source;
    const t = l.t ?? l.target?.id ?? l.target;
    if (!nmap[s] || !nmap[t] || s === t) return;
    neighbours.get(s)?.add(t);
    neighbours.get(t)?.add(s);
  });

  // Build edge set for fast lookup
  const edgeSet = new Set();
  links.forEach(l => {
    const s = l.s ?? l.source?.id ?? l.source;
    const t = l.t ?? l.target?.id ?? l.target;
    if (s && t && s !== t) {
      edgeSet.add(`${s}|${t}`);
      edgeSet.add(`${t}|${s}`);
    }
  });

  const result = new Map();
  nodes.forEach(n => {
    const nb = Array.from(neighbours.get(n.id) || []);
    if (nb.length < 2) { result.set(n.id, 0); return; }
    const possible = nb.length * (nb.length - 1) / 2;
    let actual = 0;
    for (let a = 0; a < nb.length; a++) {
      for (let b = a + 1; b < nb.length; b++) {
        if (edgeSet.has(`${nb[a]}|${nb[b]}`)) actual++;
      }
    }
    result.set(n.id, actual / possible);
  });
  return result;
}

/**
 * Link prediction: score all missing edges by likelihood of existence.
 * Returns top-K candidate edges sorted by score.
 *
 * Scores Jaccard, Adamic-Adar, and Resource Allocation, then blends them.
 *
 * @param {Array}  nodes
 * @param {Array}  links
 * @param {Object} nmap
 * @param {number} topK   - how many candidates to return (default 50)
 * @returns {Array} [{source, target, jaccard, adamicAdar, resourceAlloc, score}, ...]
 */
export function predictLinks(nodes, links, nmap, topK = 50) {
  // Build neighbour sets and degree
  const nb = new Map();
  nodes.forEach(n => nb.set(n.id, new Set()));

  const edgeSet = new Set();
  links.forEach(l => {
    const s = l.s ?? l.source?.id ?? l.source;
    const t = l.t ?? l.target?.id ?? l.target;
    if (!nmap[s] || !nmap[t] || s === t) return;
    nb.get(s)?.add(t); nb.get(t)?.add(s);
    edgeSet.add(`${s}|${t}`); edgeSet.add(`${t}|${s}`);
  });

  // Only consider nodes with at least 1 connection
  const connected = nodes.filter(n => (nb.get(n.id)?.size || 0) > 0);

  const candidates = [];

  for (let a = 0; a < connected.length; a++) {
    const u = connected[a].id;
    const nbU = nb.get(u);
    for (let b = a + 1; b < connected.length; b++) {
      const v = connected[b].id;
      // Skip existing edges
      if (edgeSet.has(`${u}|${v}`)) continue;

      const nbV = nb.get(v);
      const common = [];
      for (const w of nbU) { if (nbV.has(w)) common.push(w); }
      if (common.length === 0) continue; // no common neighbours → skip

      // Jaccard
      const union = new Set([...nbU, ...nbV]);
      const jaccard = common.length / union.size;

      // Adamic-Adar: Σ 1/log(deg(w)) for common w
      let aa = 0;
      for (const w of common) {
        const d = nb.get(w)?.size || 2;
        aa += 1 / Math.log2(d + 1);
      }

      // Resource Allocation: Σ 1/deg(w)
      let ra = 0;
      for (const w of common) {
        const d = nb.get(w)?.size || 1;
        ra += 1 / d;
      }

      // Blend (equal weight)
      const score = (jaccard + aa / 10 + ra) / 3;
      candidates.push({ source: u, target: v, jaccard, adamicAdar: aa, resourceAlloc: ra, score, common: common.length });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK);
}
