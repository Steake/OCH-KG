// ═══════════════════════════════════════════════════════════
// GRAPH LLM — Natural language query → graph actions
// ═══════════════════════════════════════════════════════════
import { callOpenRouterChat } from './client.js';

export async function callGraphLLM(query, history, OLI, CITED, ARXIV, ZENODO_KW, mode = 'graph') {
  const oliLines   = OLI.map(n   => `${n.id}[${n.cluster}★] "${n.short}" — ${(n.tags||[]).slice(0,3).join(', ')}`);
  const citedLines = CITED.map(n => `${n.id}[${n.cluster}] "${n.short}"`);
  const arxivLines = ARXIV.map(n => `${n.id}[${n.cluster}] "${n.short}"`);

  const zkByCl = {};
  ZENODO_KW.forEach(n => { (zkByCl[n.cluster]=zkByCl[n.cluster]||[]).push(`${n.id}: ${n.title.slice(0,50)}`); });
  const zkLines = Object.entries(zkByCl).map(([cl,items]) =>
    `[ZENODO ${cl} cluster — ${items.length} papers]:\n  ` + items.slice(0,18).join('\n  ')
  );

  const catalog = [
    ...oliLines, '---CITED---', ...citedLines,
    '---ARXIV---', ...arxivLines,
    '---ZENODO CORPUS---', ...zkLines
  ].join('\n');

  let sys;
  if (mode === 'query') {
    sys = `You are an expert research assistant for a knowledge graph about Oliver C. Hirst's papers and related work. Answer the user's question thoughtfully using the paper catalog below. Do NOT return any graph manipulation actions — just provide an insightful, well-structured answer.

NODE CATALOG:
${catalog}

You MUST respond with ONLY a JSON object:
{"narrative":"Your detailed answer here. Use actual paper titles and findings. Can be multiple paragraphs separated by \\n.","actions":[]}`;
  } else {
    sys = `You are an AI co-pilot for a research knowledge graph about Oliver C. Hirst's papers. Answer queries by returning graph manipulation actions.

NODE CATALOG (use these exact IDs):
${catalog}

ACTIONS (JSON array in "actions" field):
{"type":"highlight_nodes","ids":["EXACT_ID","EXACT_ID",...]}
{"type":"show_path","from":"id1","to":"id2","reason":"why"}
{"type":"find_bridges","id1":"EXACT_ID","id2":"EXACT_ID"}
{"type":"add_inferred_edges","edges":[{"source":"EXACT_ID","target":"EXACT_ID","type":"similar","reason":"<15 words>"}]}
{"type":"focus_node","id":"node_id"}
{"type":"filter_cluster","cluster":"trust|consciousness|crypto|collective"}
{"type":"reset"}

RULES: For "hidden patterns" → find_bridges + add_inferred_edges. For paths → show_path. Always write an insightful narrative using actual paper titles.

You MUST respond with ONLY a JSON object, no markdown, no explanation outside JSON:
{"narrative":"2-3 sentences","actions":[...]}`;
  }
  const msgs = [
    ...history.slice(-8).map(m => ({ role:m.role, content:m.content })),
    { role:'user', content:query }
  ];

  return callOpenRouterChat(sys, msgs, 900);
}
