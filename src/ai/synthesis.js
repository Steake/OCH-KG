// ═══════════════════════════════════════════════════════════
// SUBGRAPH SYNTHESIS — LLM-powered cluster analysis
// Produces: cluster summary · internal tensions · cross-cluster gaps
// ═══════════════════════════════════════════════════════════
import { callOpenRouterChat } from './client.js';

/**
 * Synthesise a subgraph (typically a cluster or ego-network).
 * Ranks nodes from the subgraph centroid's EQBSL perspective,
 * takes the top-k, and asks the LLM to:
 *  1. Summarise the collective argument
 *  2. Surface internal tensions / contradictions
 *  3. Identify 3 missing connections to other clusters
 *
 * Results are returned as structured JSON and can be overlaid on the graph.
 *
 * @param {Array}  subNodes   - nodes in the subgraph
 * @param {Array}  allNodes   - full nodes array (for cross-cluster candidates)
 * @param {Array}  links      - full links
 * @param {Object} nmap
 * @param {number} topK       - max nodes to include in synthesis prompt (default 15)
 * @returns {Promise<SynthesisResult>}
 */
export async function synthesiseSubgraph(subNodes, allNodes, links, nmap, topK = 15) {
  if (subNodes.length === 0) throw new Error('No nodes in subgraph');

  // Build neighbour-count map within subgraph to rank by internal importance
  const subIds = new Set(subNodes.map(n => n.id));
  const internalDeg = new Map(subNodes.map(n => [n.id, 0]));
  links.forEach(l => {
    const s = l.s ?? l.source?.id ?? l.source;
    const t = l.t ?? l.target?.id ?? l.target;
    if (subIds.has(s) && subIds.has(t)) {
      internalDeg.set(s, (internalDeg.get(s)||0) + 1);
      internalDeg.set(t, (internalDeg.get(t)||0) + 1);
    }
  });
  const ranked = subNodes.slice().sort((a, b) => (internalDeg.get(b.id)||0) - (internalDeg.get(a.id)||0));
  const coreNodes = ranked.slice(0, topK);

  // Build node descriptions for prompt
  const nodeLines = coreNodes.map(n =>
    `[${n.id}] ${n.title || n.short}\n  Abstract: ${(n.abstract||'').slice(0, 200)}\n  Tags: ${(n.tags||[]).join(', ')}`
  ).join('\n\n');

  // Build internal edge descriptions
  const internalEdges = links
    .filter(l => {
      const s = l.s ?? l.source?.id ?? l.source;
      const t = l.t ?? l.target?.id ?? l.target;
      return subIds.has(s) && subIds.has(t);
    })
    .slice(0, 40)
    .map(l => {
      const s = l.s ?? l.source?.id ?? l.source;
      const t = l.t ?? l.target?.id ?? l.target;
      return `${nmap[s]?.short||s} --[${l.type}]--> ${nmap[t]?.short||t}`;
    }).join('\n');

  // Cross-cluster candidates (for gap suggestions)
  const otherClusters = [...new Set(allNodes.filter(n => !subIds.has(n.id)).map(n => n.cluster))];
  const crossCtx = otherClusters.map(cl => {
    const reps = allNodes.filter(n => n.cluster === cl && !subIds.has(n.id)).slice(0, 5);
    return `[${cl}]: ${reps.map(n=>n.short).join(', ')}`;
  }).join('\n');

  const sys = `You are an expert research synthesiser. Analyse a subgraph from a knowledge graph and produce structured insight.

IMPORTANT: All claims must be grounded in the provided abstracts. Mark LLM-inferred claims with "(inferred)".
Respond ONLY with valid JSON.`;

  const userPrompt = `SUBGRAPH NODES (${coreNodes.length} most central):
${nodeLines}

INTERNAL EDGES:
${internalEdges}

OTHER AVAILABLE CLUSTERS FOR GAP ANALYSIS:
${crossCtx}

Produce this JSON:
{
  "summary": "2-3 sentence summary of the collective argument this subgraph makes",
  "tensions": [
    {"nodeA": "id", "nodeB": "id", "description": "specific tension or contradiction between these papers"}
  ],
  "gaps": [
    {"fromCluster": "current cluster", "toCluster": "target cluster", "missingConnection": "what connection is missing", "candidateNodeId": "node id if known"}
  ],
  "keyInsight": "most important single observation about this subgraph's structure"
}

Provide 2-3 tensions and 3 gaps. Be specific about paper titles, not generic.`;

  return callOpenRouterChat(sys, [{ role:'user', content:userPrompt }], 1200);
}

/**
 * Synthesise the full graph by cluster — scheduled/batch mode.
 * Returns a map of cluster → SynthesisResult.
 */
export async function synthesiseAllClusters(nodes, links, nmap, onProgress) {
  const clusters = [...new Set(nodes.map(n => n.cluster).filter(Boolean))];
  const results  = {};

  for (let i = 0; i < clusters.length; i++) {
    const cl = clusters[i];
    onProgress?.(`Synthesising ${cl} cluster (${i+1}/${clusters.length})…`);
    const clusterNodes = nodes.filter(n => n.cluster === cl);
    try {
      results[cl] = await synthesiseSubgraph(clusterNodes, nodes, links, nmap, 12);
    } catch(e) {
      results[cl] = { error: e.message };
    }
    // Respect rate limits
    if (i < clusters.length - 1) await new Promise(r => setTimeout(r, 1200));
  }

  return results;
}
