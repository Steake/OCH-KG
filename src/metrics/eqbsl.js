// ═══════════════════════════════════════════════════════════
// EQBSL — Equilibrium Belief System Landscape
// Jøsang Subjective Logic trust propagation
// ═══════════════════════════════════════════════════════════
import { EW } from '../config.js';

/**
 * Global EQBSL: Oli nodes are dogmatic anchors {b:1,d:0,u:0}.
 * All others start vacuous {b:0,d:0,u:1}.
 * Trust propagates via SL discounting + cumulative fusion.
 *
 * Returns arrays: eqB, eqD, eqU (Float64Array) and EP scalar array.
 */
export function computeGlobalEQBSL(nodes, links, idxOf) {
  const N = nodes.length;
  const eqB = new Float64Array(N);
  const eqD = new Float64Array(N);
  const eqU = new Float64Array(N).fill(1); // vacuous by default
  nodes.forEach((n, i) => { if (n.isOli) { eqB[i] = 1; eqU[i] = 0; } });

  _propagate(nodes, links, idxOf, eqB, eqD, eqU, n => n.isOli, 30);

  const ep = nodes.map((_, i) => eqB[i] + 0.5 * eqU[i]);
  return { eqB, eqD, eqU, ep };
}

/**
 * Perspective EQBSL: the chosen node is the sole dogmatic anchor.
 * Returns nodes ranked by E[P] as seen from that node's vantage point —
 * the "opinion space" of the selected observer.
 *
 * @param {string} nodeId  - ID of the observer node
 * @param {Array}  nodes   - full nodes array
 * @param {Array}  links   - full links array (using s/t or source/target)
 * @param {Object} idxOf   - id → index map
 * @returns {Array} sorted [{node, ep, normEP}, ...] excluding the observer
 */
export function computeEQBSLFromPerspective(nodeId, nodes, links, idxOf) {
  const N   = nodes.length;
  const src = idxOf[nodeId];
  if (src === undefined) return null;

  const eqB = new Float64Array(N);
  const eqD = new Float64Array(N);
  const eqU = new Float64Array(N).fill(1);
  eqB[src] = 1; eqU[src] = 0; // observer is dogmatic anchor

  _propagate(nodes, links, idxOf, eqB, eqD, eqU, (_, i) => i === src, 30);

  const ep    = nodes.map((_, i) => eqB[i] + 0.5 * eqU[i]);
  const maxEP = ep.reduce((m, v) => v > m ? v : m, 1e-9);

  return nodes
    .map((n, i) => ({ node: n, ep: ep[i], normEP: ep[i] / maxEP }))
    .filter(x => x.node.id !== nodeId)
    .sort((a, b) => b.ep - a.ep);
}

// ── Internal propagation engine ────────────────────────────────────────────
function _propagate(nodes, links, idxOf, eqB, eqD, eqU, isAnchor, iters) {
  for (let iter = 0; iter < iters; iter++) {
    const nB = eqB.slice(), nD = eqD.slice(), nU = eqU.slice();
    links.forEach(l => {
      const i = idxOf[l.s ?? l.source?.id ?? l.source];
      const j = idxOf[l.t ?? l.target?.id ?? l.target];
      if (i === undefined || j === undefined) return;
      if (isAnchor(nodes[j], j)) return; // anchors immutable
      const w  = EW[l.type] || 0.5;
      const dB = w * eqB[i];
      const dD = w * eqD[i];
      const dU = 1 - w * (1 - eqU[i]);
      if (dU > 0.9999) return; // skip vacuous source
      const u1 = nU[j], u2 = dU;
      const denom = u1 + u2 - u1 * u2;
      if (denom < 1e-10) {
        nB[j] = (nB[j] + dB) * 0.5;
        nD[j] = (nD[j] + dD) * 0.5;
        nU[j] = 0;
      } else {
        nB[j] = (nB[j] * u2 + dB * u1) / denom;
        nD[j] = (nD[j] * u2 + dD * u1) / denom;
        nU[j] = (u1 * u2) / denom;
      }
    });
    eqB.set(nB); eqD.set(nD); eqU.set(nU);
  }
}
