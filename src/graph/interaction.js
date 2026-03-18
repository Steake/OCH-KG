// ═══════════════════════════════════════════════════════════
// GRAPH INTERACTIONS
// Hover · click · tooltip · filter · search · zoom
// ═══════════════════════════════════════════════════════════
import { EDGE_EPISTEMIC, CC } from '../config.js';

export let selected = null; // currently selected node ID

export function setSelected(id) { selected = id; }

// ── Highlight ──────────────────────────────────────────────────────────────
export function highlight(d, nodeEl, linkEl, linkData) {
  const conn = new Set([d.id]);
  linkData.forEach(l => {
    const sid = l.source.id || l.source;
    const tid = l.target.id || l.target;
    if (sid === d.id) conn.add(tid);
    if (tid === d.id) conn.add(sid);
  });
  nodeEl.classed("faded", n => !conn.has(n.id));
  linkEl.classed("faded", l => {
    const sid = l.source.id || l.source;
    const tid = l.target.id || l.target;
    return !(conn.has(sid) && conn.has(tid));
  });
  linkEl.classed("lit", l => {
    const sid = l.source.id || l.source;
    const tid = l.target.id || l.target;
    return sid === d.id || tid === d.id;
  });
}

export function unhighlight(nodeEl, linkEl, chatDimRect, svg) {
  nodeEl.classed("faded", false);
  linkEl.classed("faded", false).classed("lit", false);
  chatDimRect?.transition().duration(300).attr('fill-opacity', 0);
  svg?.classed('chat-subgraph', false);
}

// ── Tooltip ────────────────────────────────────────────────────────────────
function srcBadge(n) {
  const colors = { arXiv:"#f0c040", Zenodo:"#5b90ff", external:"#708090", local:"#b060ff" };
  const c = colors[n.src] || "#888";
  return `<span class="tag" style="border:1px solid ${c}40;color:${c}">${n.src}</span>`;
}

export function showNodeTip(tip, e, d) {
  const auth = d.authors.slice(0,3).join(", ") + (d.authors.length > 3 ? " et al." : "");
  const tags = d.tags.map(t => `<span class="tag">${t}</span>`).join("");
  const oliBadge = d.isOli ? `<span class="tag oli">✦ Oli's paper</span>` : "";
  const href = d.url || (d.doi ? `https://doi.org/${d.doi}` : null);
  const linkHtml = href
    ? `<div class="lnk"><a href="${href}" target="_blank" rel="noopener">↗ Open paper</a></div>`
    : '';

  // For mobile/touch, we use a slightly different layout or behavioral flag
  const isTouch = e.type.startsWith('touch') || (window.innerWidth < 640);

  tip.html(`
    <div class="tip-header">
       <div class="t">${d.title}</div>
       ${isTouch ? '<button class="tip-close" onclick="d3.select(\'#tip\').classed(\'show\', false)">✕</button>' : ''}
    </div>
    <div class="a">${auth} · ${d.year || "?"}</div>
    <div class="tags">${oliBadge}${srcBadge(d)}${tags}</div>
    <div class="abs">${d.abstract}</div>
    ${linkHtml}
  `).classed("show", true);
  
  if (isTouch) {
    // Center on screen for touch
    tip.style("left", "50%").style("top", "50%").style("transform", "translate(-50%, -50%)");
  } else {
    const tx = Math.min(e.clientX + 18, window.innerWidth - 330);
    const ty = Math.min(e.clientY + 18, window.innerHeight - 220);
    tip.style("left", tx+"px").style("top", ty+"px").style("transform", "none");
  }
}

export function showLinkTip(linkTip, e, l, nmap) {
  const sid = l.source?.id || l.source;
  const tid = l.target?.id || l.target;
  const sn = nmap[sid], tn = nmap[tid];
  const ltype = l.type || 'similar';
  const isTouch = e.type.startsWith('touch') || (window.innerWidth < 640);

  const typeColor = {
    cites:'#4a6aaa', extends:'#8060d0', inherits:'#7060d8', uses:'#406858',
    seeds:'#7060c0', supports:'#405868', publishes_to:'#404890',
    integrates:'#706840', builds_on:'#806040', similar:'#2a5040',
  }[ltype] || '#4a5878';
  const epistemic = EDGE_EPISTEMIC[ltype] || 'Thematic connection';
  const reason = l.reason ? `<div class="lreason">🤖 ${l.reason}</div>` : '';
  linkTip.html(`
    <div class="tip-header">
      <div class="ltype" style="color:${typeColor}">${ltype.replace('_',' ')}</div>
      ${isTouch ? '<button class="tip-close" onclick="d3.select(\'#linkTip\').classed(\'show\', false)">✕</button>' : ''}
    </div>
    <div class="lpath">${sn?.short || sid} → ${tn?.short || tid}</div>
    <div class="lroot">${epistemic}</div>
    ${reason}
  `).classed("show", true);
  moveLinkTip(linkTip, e);
}

export function moveLinkTip(linkTip, e) {
  const isTouch = e.type.startsWith('touch') || (window.innerWidth < 640);
  if (isTouch) {
    linkTip.style("left", "50%").style("top", "50%").style("transform", "translate(-50%, -50%)");
  } else {
    const tx = Math.min(e.clientX + 14, window.innerWidth - 295);
    const ty = Math.min(e.clientY + 14, window.innerHeight - 150);
    linkTip.style("left", tx+"px").style("top", ty+"px").style("transform", "none");
  }
}

// ── Filter buttons ─────────────────────────────────────────────────────────
export function bindFilterButtons(nodeEl, linkEl, nmap) {
  document.querySelectorAll(".pill[data-f]").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".pill[data-f]").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const f = this.dataset.f;
      nodeEl.classed("faded", n => {
        if (f === "all") return false;
        if (f === "oli") return !n.isOli;
        if (f === "arxiv") return n.src !== "arXiv";
        if (f === "zenodo") return n.src !== "Zenodo";
        return n.cluster !== f;
      });
      linkEl.classed("faded", l => {
        if (f === "all") return false;
        const s = nmap[l.source.id || l.source];
        const t = nmap[l.target.id || l.target];
        if (f === "oli") return !(s?.isOli || t?.isOli);
        if (f === "arxiv") return !(s?.src === "arXiv" || t?.src === "arXiv");
        if (f === "zenodo") return !(s?.src === "Zenodo" || t?.src === "Zenodo");
        return !(s?.cluster === f || t?.cluster === f);
      });
    });
  });
}

// ── Search ─────────────────────────────────────────────────────────────────
export function bindSearch(nodeEl, linkEl, nodes) {
  document.getElementById("search").addEventListener("input", function() {
    const q = this.value.toLowerCase().trim();
    if (!q) { nodeEl.classed("faded", false); linkEl.classed("faded", false); return; }
    const matched = new Set(nodes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.authors.some(a => a.toLowerCase().includes(q)) ||
      n.tags.some(t => t.toLowerCase().includes(q)) ||
      (n.abstract || "").toLowerCase().includes(q)
    ).map(n => n.id));
    nodeEl.classed("faded", d => !matched.has(d.id));
    linkEl.classed("faded", l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      return !(matched.has(sid) || matched.has(tid));
    });
  });
}

// ── Graph traversal helpers (used by chat) ─────────────────────────────────
export function getNeighborhood(id, depth, linkData) {
  const visited = new Set([id]); let frontier = [id];
  for (let d = 0; d < depth; d++) {
    const next = [];
    frontier.forEach(n => {
      linkData.forEach(l => {
        const s = l.source?.id||l.source, t = l.target?.id||l.target;
        if (s===n&&!visited.has(t)){visited.add(t);next.push(t);}
        if (t===n&&!visited.has(s)){visited.add(s);next.push(s);}
      });
    });
    frontier = next;
  }
  return visited;
}

export function bfsPath(fromId, toId, maxDepth, linkData) {
  const adj = {};
  linkData.forEach(l => {
    const s=l.source?.id||l.source, t=l.target?.id||l.target;
    if (!adj[s]) adj[s]=[]; if (!adj[t]) adj[t]=[];
    adj[s].push({id:t,link:l}); adj[t].push({id:s,link:l});
  });
  const queue=[[fromId,[fromId],[]]]; const visited=new Set([fromId]);
  while(queue.length){
    const [cur,path,ep]=queue.shift();
    if(cur===toId) return {nodes:path,edges:ep};
    if(path.length>=maxDepth) continue;
    for(const {id,link} of (adj[cur]||[])){
      if(!visited.has(id)){visited.add(id);queue.push([id,[...path,id],[...ep,link]]);}
    }
  }
  return null;
}

export function fuzzyFindNode(q, nodes, nmap) {
  if (!q) return null;
  const ql = q.toLowerCase().replace(/[^a-z0-9_]/g,'');
  if (nmap[q]) return q;
  if (nmap[ql]) return ql;
  for (const n of nodes) {
    const nid = n.id.toLowerCase().replace(/[^a-z0-9_]/g,'');
    if (nid === ql) return n.id;
  }
  for (const n of nodes) {
    if (n.id.toLowerCase().includes(ql) || ql.includes(n.id.toLowerCase())) return n.id;
  }
  const words = q.toLowerCase().split(/[\s_\-:,]+/).filter(w=>w.length>2);
  if (!words.length) return null;
  let best=null, bestScore=0;
  nodes.forEach(n => {
    const txt = (n.id+' '+n.title+' '+n.short+' '+(n.tags||[]).join(' ')).toLowerCase();
    const hits = words.filter(w=>txt.includes(w)).length;
    const score = hits / words.length;
    if(score>bestScore){bestScore=score;best=n.id;}
  });
  return bestScore >= 0.15 ? best : null;
}
