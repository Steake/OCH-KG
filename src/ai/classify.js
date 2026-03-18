// ═══════════════════════════════════════════════════════════
// PAPER CLASSIFICATION — classify a new paper and generate edges
// ═══════════════════════════════════════════════════════════
import { callOpenRouter } from './client.js';

export async function classifyWithLLM(meta, OLI, CITED, ARXIV, nmap) {
  const allNodes = [
    ...OLI.map(n   => ({ id:n.id, label:n.short, tags:n.tags, cluster:n.cluster, isOli:true  })),
    ...CITED.map(n => ({ id:n.id, label:n.short, tags:n.tags, cluster:n.cluster              })),
    ...ARXIV.map(n => ({ id:n.id, label:n.short, tags:n.tags, cluster:n.cluster              })),
  ];
  const nodeContext = allNodes.map(n =>
    `${n.id} [${n.cluster}${n.isOli?' ★OLI':''}]: ${n.label} — ${(n.tags||[]).join(', ')}`
  ).join('\n');

  const prompt = `You are building a knowledge graph of research papers. Classify a new paper and generate typed edges to existing nodes.

CLUSTERS: trust (subjective logic, trust systems, reputation, Bayesian), consciousness (cognitive architectures, self-awareness, minds, AGI), crypto (ZK proofs, blockchain, cryptography, consensus), collective (multi-agent, coordination, swarms).

EDGE TYPES:
- "cites": paper directly references this work
- "extends": paper directly builds on / extends this work
- "builds_on": paper uses ideas from this work as foundation
- "similar": paper is thematically adjacent / comparable
- "uses": paper applies this technique/framework

NEW PAPER:
Title: ${meta.title}
Abstract: ${(meta.abstract||'').slice(0,600)}

EXISTING NODES (id [cluster ★=Oli's paper]: label — tags):
${nodeContext}

Return ONLY valid JSON — no markdown, no extra text:
{
  "cluster": "trust|consciousness|crypto|collective",
  "tags": ["tag1","tag2","tag3"],
  "edges": [
    {"target":"<node_id>","type":"similar|cites|extends|builds_on|uses","reason":"<why>"},
    {"target":"<node_id>","type":"similar|cites|extends|builds_on|uses","reason":"<why>"}
  ],
  "reason": "<one sentence summary of relevance>"
}

Generate 2-6 edges to the most relevant nodes. Prefer Oli's papers (★OLI) as targets when relevant.`;

  try {
    const result = await callOpenRouter(prompt, 500);
    if (result.edges) {
      result.edges = result.edges.filter(e =>
        e.target && nmap[e.target] &&
        ['similar','cites','extends','builds_on','uses','inherits'].includes(e.type)
      );
    }
    return result;
  } catch(e) {
    // Keyword fallback
    const txt = (meta.title + ' ' + meta.abstract).toLowerCase();
    const cluster = txt.includes('trust') || txt.includes('reputation') || txt.includes('bayesian') ? 'trust'
      : txt.includes('conscious') || txt.includes('cognit') || txt.includes('mind') ? 'consciousness'
      : txt.includes('zero-knowledge') || txt.includes('zk') || txt.includes('blockchain') ? 'crypto'
      : txt.includes('multi-agent') || txt.includes('collective') || txt.includes('swarm') ? 'collective'
      : 'trust';
    const fb = { trust:'eqbsl', consciousness:'godelos', crypto:'bitcoll', collective:'plenum' }[cluster];
    return { cluster, tags:[], edges:[{target:fb, type:'similar', reason:'Keyword-based match'}], reason:'Classified by keyword fallback' };
  }
}
