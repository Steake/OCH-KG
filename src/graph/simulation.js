// ═══════════════════════════════════════════════════════════
// D3 FORCE SIMULATION
// ═══════════════════════════════════════════════════════════
import { CC } from '../config.js';

export function buildSimulation(nodes, linkData, W, H, d3) {
  const nmap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Performance adjustment for mobile: reduce iteration complexity
  const isMobile = W < 640;

  const sim = d3.forceSimulation(nodes)
    .alphaDecay(isMobile ? 0.035 : 0.0228) // Cool down faster on mobile
    .velocityDecay(isMobile ? 0.5 : 0.4)    // More friction/stability
    .force("link", d3.forceLink(linkData).id(d => d.id)
      .distance(l => {
        const s = nmap[l.source?.id || l.source];
        const t = nmap[l.target?.id || l.target];
        if (s?.isOli && t?.isOli) return isMobile ? 70 : 95;
        return isMobile ? 60 : 80;
      })
      .strength(l => (isMobile ? 0.25 : 0.35)))
    .force("charge", d3.forceManyBody().strength(d => {
      const b = d.isOli ? -500 : -150;
      return isMobile ? b * 0.7 : b;
    }))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide(d => d.r + (isMobile ? 12 : 20)))
    .force("cluster", alpha => {
      // Opt-out of cluster force during high alpha ranges on mobile to save frames
      if (isMobile && alpha > 0.8) return; 

      const centroids = {};
      nodes.forEach(n => {
        const k = n.isOli ? "OLI" : n.cluster;
        if (!centroids[k]) centroids[k] = { x:0, y:0, c:0 };
        centroids[k].x += n.x; centroids[k].y += n.y; centroids[k].c++;
      });
      Object.values(centroids).forEach(c => { c.x /= c.c; c.y /= c.c; });
      nodes.forEach(n => {
        const k = n.isOli ? "OLI" : n.cluster;
        const c = centroids[k];
        if (c) {
          n.vx += (c.x - n.x) * alpha * (n.isOli ? 0.05 : 0.025);
          n.vy += (c.y - n.y) * alpha * (n.isOli ? 0.05 : 0.025);
        }
      });
    });

  return sim;
}

/**
 * Switch to spectral layout (graph Laplacian eigenvectors).
 * Computes the 2nd and 3rd Fiedler vectors and positions nodes
 * by structural similarity rather than spring physics.
 */
export function spectralLayout(nodes, links, W, H) {
  const N = nodes.length;
  if (N < 3) return;
  const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]));

  // Build normalised Laplacian
  const deg = new Float64Array(N);
  links.forEach(l => {
    const i = idx[l.s ?? l.source?.id ?? l.source];
    const j = idx[l.t ?? l.target?.id ?? l.target];
    if (i !== undefined && j !== undefined && i !== j) { deg[i]++; deg[j]++; }
  });

  // Power iteration for 2 smallest non-trivial eigenvectors
  // Simplified: use random projection + orthogonalise (fast approximation)
  const v1 = Array.from({length: N}, () => Math.random() - 0.5);
  const v2 = Array.from({length: N}, () => Math.random() - 0.5);

  function laplacianMul(v) {
    const result = v.map((vi, i) => deg[i] * vi);
    links.forEach(l => {
      const i = idx[l.s ?? l.source?.id ?? l.source];
      const j = idx[l.t ?? l.target?.id ?? l.target];
      if (i !== undefined && j !== undefined && i !== j) {
        result[i] -= v[j]; result[j] -= v[i];
      }
    });
    return result;
  }

  function normalise(v) {
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map(x => x / norm);
  }

  function orthogonalise(v, against) {
    const dot = v.reduce((s, vi, i) => s + vi * against[i], 0);
    return v.map((vi, i) => vi - dot * against[i]);
  }

  // Constant vector (trivial eigenvector, eigenvalue 0)
  const ones = normalise(Array.from({length: N}, () => 1));

  // Power iteration for Fiedler vector (2nd eigenvector)
  let u1 = normalise(v1);
  for (let it = 0; it < 60; it++) {
    u1 = normalise(orthogonalise(laplacianMul(u1), ones));
  }

  let u2 = normalise(v2);
  for (let it = 0; it < 60; it++) {
    u2 = normalise(orthogonalise(orthogonalise(laplacianMul(u2), ones), u1));
  }

  // Scale to canvas
  const margin = 80;
  const scaleX = (W - 2 * margin) / 2, scaleY = (H - 2 * margin) / 2;
  nodes.forEach((n, i) => {
    n.fx = W / 2 + u1[i] * scaleX;
    n.fy = H / 2 + u2[i] * scaleY;
  });
}

/** Release spectral pinning, return to physics. */
export function releaseSpectralLayout(nodes) {
  nodes.forEach(n => { n.fx = null; n.fy = null; });
}
