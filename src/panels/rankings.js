// ═══════════════════════════════════════════════════════════
// RANKINGS PANEL
// Centrality leaderboard + EQBSL perspective mode
// ═══════════════════════════════════════════════════════════
import { computeEQBSLFromPerspective } from '../metrics/eqbsl.js';

export let currentRankTab = 'overall';

const RANK_META = {
  overall:  { label:'Overall',     normKey:'normComp', color:'#8ab4ff', fmt: n => (n._m.composite * 100).toFixed(1) + '%' },
  eqbsl:    { label:'EQBSL E[P]',  normKey:'normEP',   color:'#5ecfa0', fmt: n => 'E[P]=' + n._m.eqbslEP.toFixed(3) },
  pagerank: { label:'PageRank',    normKey:'normPR',    color:'#f0a040', fmt: n => 'PR=' + n._m.pagerank.toExponential(2) },
  degree:   { label:'Degree',      normKey:'normDeg',   color:'#60c8f0', fmt: n => 'deg=' + n._m.degree },
  between:  { label:'Betweenness', normKey:'normBC',    color:'#b07dff', fmt: n => n._m.between.toFixed(4) },
  close:    { label:'Closeness',   normKey:'normCL',    color:'#7ae4b8', fmt: n => n._m.close.toFixed(3) },
};

const clClrMap = {
  consciousness:'#b07dff', trust:'#5ecfa0', crypto:'#f0a040', collective:'#60c8f0'
};

export function setRankTab(metric, renderFn) {
  currentRankTab = metric;
  document.querySelectorAll('.rp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.metric === metric));
  renderFn();
}

/**
 * Render the rankings list.
 *
 * When EQBSL tab is active AND a node is selected, renders perspective mode —
 * the opinion space as seen from the selected node.
 * Otherwise renders global centrality ranking.
 */
export function renderRankings(state) {
  const { G, nodes, links, idxOf, nmap, selected, jumpFromRankings } = state;
  if (!G) return;

  const subEl = document.getElementById('rpSubLine');
  const perspBar = document.getElementById('rpPerspectiveBar');

  // ── EQBSL perspective mode ────────────────────────────────────────────
  if (currentRankTab === 'eqbsl' && selected) {
    const sn = nmap[selected];
    if (subEl) subEl.textContent = `EQBSL perspective`;
    if (perspBar) {
      perspBar.classList.add('visible');
      perspBar.innerHTML = `Observer: <span>${sn?.short || selected}</span> — opinion space from this node's vantage point`;
    }

    const persp = computeEQBSLFromPerspective(selected, nodes, links, idxOf);
    if (!persp) { document.getElementById('rpList').innerHTML = ''; return; }

    const html = persp.slice(0, 60).map(({ node: n, ep, normEP }, i) => {
      const rank  = i + 1;
      const rCls  = rank === 1 ? 'gold' : rank <= 3 ? 'silver' : rank <= 10 ? 'bronze' : '';
      const pct   = Math.round(normEP * 100);
      const oliDot = n.isOli ? ' <span style="color:#6e9fff">✦</span>' : '';
      const clClr  = clClrMap[n.cluster] || '#4a5878';
      return `<div class="rp-row" onclick="window._jumpFromRankings('${n.id}')">
        <span class="rp-row-rank ${rCls}">${rank}</span>
        <div class="rp-row-info">
          <div class="rp-row-title" title="${(n.title||'').replace(/"/g,'&quot;')}">${n.short || n.id}${oliDot}</div>
          <div class="rp-row-sub" style="color:${clClr}">${n.cluster||'?'} · E[P]=${ep.toFixed(3)}</div>
        </div>
        <div class="rp-bar-col">
          <div class="rp-bar-bg"><div class="rp-bar-fg" style="width:${pct}%;background:#5ecfa0"></div></div>
          <div class="rp-score-lbl">${pct}%</div>
        </div>
      </div>`;
    }).join('');
    document.getElementById('rpList').innerHTML = html;
    return;
  }

  // ── Global ranking ────────────────────────────────────────────────────
  if (subEl) subEl.textContent = 'Centrality metrics · EQBSL trust propagation';
  if (perspBar) perspBar.classList.remove('visible');

  const sorted = G[currentRankTab] || G.overall;
  const meta   = RANK_META[currentRankTab] || RANK_META.overall;

  const html = sorted.slice(0, 60).map((n, i) => {
    const rank  = i + 1;
    const rCls  = rank === 1 ? 'gold' : rank <= 3 ? 'silver' : rank <= 10 ? 'bronze' : '';
    const pct   = Math.round((n._m[meta.normKey] || 0) * 100);
    const sub   = meta.fmt(n);
    const oliDot = n.isOli ? ' <span style="color:#6e9fff">✦</span>' : '';
    const clClr  = clClrMap[n.cluster] || '#4a5878';
    return `<div class="rp-row" onclick="window._jumpFromRankings('${n.id}')">
      <span class="rp-row-rank ${rCls}">${rank}</span>
      <div class="rp-row-info">
        <div class="rp-row-title" title="${(n.title||'').replace(/"/g,'&quot;')}">${n.short || n.id}${oliDot}</div>
        <div class="rp-row-sub" style="color:${clClr}">${n.cluster||'?'} · ${sub}</div>
      </div>
      <div class="rp-bar-col">
        <div class="rp-bar-bg"><div class="rp-bar-fg" style="width:${pct}%;background:${meta.color}"></div></div>
        <div class="rp-score-lbl">${pct}%</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('rpList').innerHTML = html;
}
