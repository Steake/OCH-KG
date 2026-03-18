// ═══════════════════════════════════════════════════════════
// BATCH AI EDGE GENERATION for the Zenodo corpus
// ═══════════════════════════════════════════════════════════
import { callOpenRouter } from './client.js';
import { rerenderLinks } from '../graph/render.js';

export async function batchAIEdges(ctx) {
  const {
    OLI, CITED, ARXIV, ZENODO_KW, nodes, nmap,
    linkData, linkG, linkHitG, sim,
    onLinkOver, onLinkMove, onLinkOut,
  } = ctx;

  const btn      = document.getElementById('aiEdgesBtn');
  const prog     = document.getElementById('aiProgress');
  const progText = document.getElementById('aiProgressText');
  const progFill = document.getElementById('aiProgressFill');

  btn.textContent = '⏳ Running…';
  btn.style.pointerEvents = 'none';
  prog.style.display = 'block';

  const corpus = ZENODO_KW.slice();
  let newEdges = 0;
  const BATCH  = 4, DELAY = 600;
  const validTypes = new Set(['similar','cites','extends','builds_on','uses','inherits','supports']);

  const existingEdgeKeys = new Set(
    linkData.map(l => `${l.source?.id||l.source}→${l.target?.id||l.target}→${l.type}`)
  );
  const runNumber = (batchAIEdges._runs = (batchAIEdges._runs || 0) + 1);

  const staticCtx = [
    '=== OLI (Oliver C. Hirst — ★ priority targets) ===',
    ...OLI.map(n => `${n.id} [${n.cluster} ★]: ${n.short} | ${(n.tags||[]).slice(0,3).join(', ')}`),
    '=== CITED (foundational referenced works) ===',
    ...CITED.map(n => `${n.id} [${n.cluster}]: ${n.short}`),
    '=== ARXIV (adjacent discovered papers) ===',
    ...ARXIV.map(n => `${n.id} [${n.cluster}]: ${n.short}`),
  ].join('\n');

  const byCluster = {};
  ZENODO_KW.forEach(n => { (byCluster[n.cluster] = byCluster[n.cluster]||[]).push(n); });

  function getPeerCtx(paper) {
    const peers = (byCluster[paper.cluster]||[])
      .filter(p => p.id !== paper.id).slice(0, 22)
      .map(p => `${p.id} [${p.cluster} ZK]: ${p.title.slice(0,55)}`);
    return peers.length ? `=== SAME-CLUSTER ZENODO PEERS ===\n${peers.join('\n')}` : '';
  }

  const rerender = () => {
    rerenderLinks(linkG, linkHitG, linkData, nmap, onLinkOver, onLinkMove, onLinkOut);
    sim.force('link').links(linkData);
    sim.alpha(0.15).restart();
    document.getElementById('se').textContent = linkData.length;
  };

  for (let i = 0; i < corpus.length; i += BATCH) {
    const batch = corpus.slice(i, i + BATCH);
    progFill.style.width = Math.round((i / corpus.length) * 100) + '%';
    progText.textContent = `Run #${runNumber} — AI edges: ${i}/${corpus.length} · ${newEdges} new edges`;

    await Promise.all(batch.map(async paper => {
      const peerCtx = getPeerCtx(paper);
      const prompt = `You are building a DENSE knowledge graph. Generate many typed edges to create rich connections AND orbiting enclaves between same-cluster papers.

EDGE TYPES: similar (adjacent), cites (references), extends (formally builds on), builds_on (uses as foundation), uses (applies technique), supports (corroborates)

RULES:
- Generate 4-8 NEW edges — be VERY LIBERAL
- This is run #${runNumber} — explore DIFFERENT connections than typical
- Include edges to OLI ★ papers, CITED works, ARXIV papers, AND ZENODO PEERS
- Any thematic adjacency qualifies for "similar"
- reason: max 8 words

NEW PAPER [${paper.cluster}]: "${paper.title}"
${paper.abstract.slice(0,300)}

${staticCtx}

${peerCtx}

RETURN ONLY JSON:
{"edges":[{"target":"node_id","type":"type","reason":"short reason"}]}`;

      try {
        const result = await callOpenRouter(prompt, 450);
        const edges = (result.edges||[]).filter(e =>
          e.target && nmap[e.target] && e.target !== paper.id && validTypes.has(e.type)
        );
        if (edges.length === 0) {
          const fb = { trust:'eqbsl', consciousness:'godelos', crypto:'bitcoll', collective:'plenum' }[paper.cluster] || 'eqbsl';
          const key = `${paper.id}→${fb}→similar`;
          if (!existingEdgeKeys.has(key)) {
            linkData.push({source:paper.id, target:fb, type:'similar', reason:'Cluster fallback'});
            existingEdgeKeys.add(key); newEdges++;
          }
        } else {
          edges.forEach(e => {
            const key = `${paper.id}→${e.target}→${e.type}`;
            if (!existingEdgeKeys.has(key)) {
              linkData.push({source:paper.id, target:e.target, type:e.type, reason:e.reason||''});
              existingEdgeKeys.add(key); newEdges++;
            }
          });
        }
      } catch(err) {
        const fb = { trust:'eqbsl', consciousness:'godelos', crypto:'bitcoll', collective:'plenum' }[paper.cluster] || 'eqbsl';
        const key = `${paper.id}→${fb}→similar`;
        if (!existingEdgeKeys.has(key)) {
          linkData.push({source:paper.id, target:fb, type:'similar', reason:'Error fallback'});
          existingEdgeKeys.add(key); newEdges++;
        }
      }
    }));

    rerender();
    if (i + BATCH < corpus.length) await new Promise(r => setTimeout(r, DELAY));
  }

  progFill.style.width = '100%';
  progText.textContent = `✓ Run #${runNumber} done! +${newEdges} new edges (total: ${linkData.length})`;
  btn.textContent = '🤖 AI Edges';
  btn.style.pointerEvents = 'auto';
  setTimeout(() => { prog.style.display = 'none'; }, 6000);
}
