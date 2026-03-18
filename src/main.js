// ═══════════════════════════════════════════════════════════
// MAIN — entry point, wires all modules together
// ═══════════════════════════════════════════════════════════

import { OLI }       from './data/oli.js';
import { CITED }     from './data/cited.js';
import { ARXIV }     from './data/arxiv.js';
import { ZENODO_KW } from './data/zenodo.js';
import { LINKS }     from './data/links.js';

import { CC, OLI_C, LINK_STYLE } from './config.js';
import { setModel, fetchFreeModels } from './ai/client.js';
import { saveSession, loadSession, clearSession, sessionSummary } from './data/session-store.js';

import { computeCentrality, normArr } from './metrics/centrality.js';
import { computeGlobalEQBSL }         from './metrics/eqbsl.js';
import { detectCommunities }          from './metrics/community.js';
import { computeBurtConstraint, computoEgoDensity, predictLinks } from './metrics/advanced.js';

import { buildSimulation, spectralLayout, releaseSpectralLayout } from './graph/simulation.js';
import { buildDefs, renderLinks, renderNodes, renderClusterHulls, rerenderLinks } from './graph/render.js';
import { highlight, unhighlight, showNodeTip, showLinkTip, moveLinkTip, bindFilterButtons, bindSearch, fuzzyFindNode } from './graph/interaction.js';

import { openNodeDetail, closeNodeDetail, nodeDetailId } from './panels/detail.js';
import { renderRankings, setRankTab } from './panels/rankings.js';
import { addMsg, chatHistory, executeActions, chatHighlightNodes, chatFocusNode, clearChatActions, renderInferred, chatMode, setChatMode, attachBubbleHighlight } from './panels/chat.js';
import { BottomSheet } from './ui/bottom-sheet.js';

import { callGraphLLM }    from './ai/graph-llm.js';
import { classifyWithLLM } from './ai/classify.js';
import { batchAIEdges }    from './ai/edges.js';
import { synthesiseSubgraph, synthesiseAllClusters } from './ai/synthesis.js';
import { fetchMetaFromInput } from './sources/fetch.js';
import { fetchAdjacentWork }  from './sources/semantic-scholar.js';

// ── Expose d3 globally (loaded via CDN script tag) ─────────────────────────
const d3 = window.d3;
window._d3 = d3;

// ── Build nodes array ──────────────────────────────────────────────────────
const nodes = [
  ...OLI.map(n       => ({ ...n, isOli: true  })),
  ...CITED.map(n     => ({ ...n, isOli: false })),
  ...ARXIV.map(n     => ({ ...n, isOli: false })),
  ...ZENODO_KW.map(n => ({ ...n, isOli: false })),
];
const nmap     = Object.fromEntries(nodes.map(n => [n.id, n]));
const linkData = LINKS.map(l => ({ source: l.s, target: l.t, type: l.type }));
const STATIC_EDGE_COUNT = linkData.length;  // ← snapshot before any session restore

window._nmap     = nmap;
window._nodes    = nodes;
window._linkData = linkData;

// ── Session restore (dynamic nodes + AI edges — injected before initial render) ─
const _sess = loadSession();
_sess.dynNodes.forEach(n => { if (!nmap[n.id]) { nodes.push(n); nmap[n.id] = n; } });
_sess.sessionEdges.forEach(e => {
  if (e.s && e.t) linkData.push({ source: e.s, target: e.t, type: e.type || 'similar', reason: e.reason || '' });
});
if (_sess.dynNodes.length || _sess.sessionEdges.length) {
  const t = _sess.savedAt ? new Date(_sess.savedAt).toLocaleTimeString() : 'unknown';
  console.info(`[session] Restored ${_sess.dynNodes.length} nodes, ${_sess.sessionEdges.length} AI edges, ${_sess.inferredEdges.length} inferred — from ${t}`);
}

// ── SVG setup ──────────────────────────────────────────────────────────────
const W = window.innerWidth, H = window.innerHeight;
window._W = W; window._H = H;

const svg  = d3.select("#canvas");
svg.attr("width", W).attr("height", H);
const g    = svg.append("g");
const zoom = d3.zoom().scaleExtent([0.15, 5])
  .on("zoom", e => g.attr("transform", e.transform));
svg.call(zoom);
window._zoom = zoom;

// ── Defs & gradients ───────────────────────────────────────────────────────
const { defs, makeGrad } = buildDefs(svg);
OLI.forEach(n => makeGrad(`grad_${n.id}`, CC[n.cluster]?.fill || "#aaa", "#222"));

// ── Links ──────────────────────────────────────────────────────────────────
const { linkG, linkHitG, linkEl, linkHit } = renderLinks(g, linkData, nmap);

// ── Chat dim rect (z-order: below nodes, above links) ─────────────────────
const chatDimRect = g.append("rect")
  .attr("id","chatDimRect")
  .attr("x",-60000).attr("y",-60000)
  .attr("width",120000).attr("height",120000)
  .attr("fill","rgb(0,3,12)").attr("fill-opacity",0)
  .attr("pointer-events","none");

// ── Mobile Menu Toggle ─────────────────────────────────────────────────────
window.toggleMenu = function() {
  const nav = document.getElementById('controls');
  const isOpen = nav.classList.toggle('open');
  document.body.classList.toggle('menu-open', isOpen);
};

// Auto-close mobile menu when any pill / button is tapped
document.getElementById('controls').addEventListener('click', e => {
  if (e.target.closest('.pill') && window.innerWidth <= 639) {
    document.getElementById('controls').classList.remove('open');
    document.body.classList.remove('menu-open');
  }
});

// ── Legend Toggle ──────────────────────────────────────────────────────────
window.toggleLegend = function() {
  document.getElementById('legend').classList.toggle('collapsed');
};

// ── Nodes ──────────────────────────────────────────────────────────────────
const nodeEl = renderNodes(g, nodes, OLI, d3);

// ── Cluster hulls ──────────────────────────────────────────────────────────
const { hullG, redrawHulls } = renderClusterHulls(g, nodes, d3);
let hullsVisible = false;

// ── Simulation ─────────────────────────────────────────────────────────────
const sim = buildSimulation(nodes, linkData, W, H, d3);
window._sim = sim;

// ── Link tooltip ───────────────────────────────────────────────────────────
const linkTip = d3.select("#linkTip");
const tip     = d3.select("#tip");

function _moveLinkTipFn(e) { if (window.innerWidth >= 640) moveLinkTip(linkTip, e); }

linkHit
  .on("mouseover", (e, l) => { 
    if (window.innerWidth < 640) return; // Only hover on desktop
    showLinkTip(linkTip, e, l, nmap); tip.classed("show", false); 
  })
  .on("mousemove", _moveLinkTipFn)
  .on("mouseout",  () => { if (window.innerWidth >= 640) linkTip.classed("show", false); });

// Add long-press for mobile link tooltip
linkHit.on("touchstart", (e, l) => {
  if (window.innerWidth >= 640) return;
  const timer = setTimeout(() => {
    showLinkTip(linkTip, e, l, nmap);
    tip.classed("show", false);
    // Vibrate to provide tactile feedback if supported
    if (navigator.vibrate) navigator.vibrate(20);
  }, 500);
  d3.select(e.currentTarget).on("touchend touchmove", () => clearTimeout(timer), {once:true});
});

// ── Interaction state ──────────────────────────────────────────────────────
let selected = null;
let tempLinks = [];
// Restore inferred (chat) edges from previous session
_sess.inferredEdges.forEach(e => {
  if (nmap[e.s] && nmap[e.t]) tempLinks.push({ source: e.s, target: e.t, type: 'similar', reason: e.reason || '' });
});
if (tempLinks.length) renderInferred(g, tempLinks, nmap, linkTip, sim, _moveLinkTipFn);
let tipHideTimer = null;

tip
  .on("mouseenter", () => { if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; } })
  .on("mouseleave", () => { if (window.innerWidth >= 640) { tip.classed("show", false); if (!selected) unhighlight(nodeEl, linkEl, chatDimRect, svg); } });

nodeEl
  .on("mouseover", (e, d) => {
    if (window.innerWidth < 640) return;
    if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
    showNodeTip(tip, e, d);
    if (!selected) highlight(d, nodeEl, linkEl, linkData);
  })
  .on("mousemove", (e) => {
    if (window.innerWidth < 640) return;
    const tx = Math.min(e.clientX + 18, window.innerWidth - 330);
    const ty = Math.min(e.clientY + 18, window.innerHeight - 220);
    tip.style("left", tx+"px").style("top", ty+"px");
  })
  .on("mouseout", () => {
    if (window.innerWidth < 640) return;
    tipHideTimer = setTimeout(() => {
      tip.classed("show", false);
      if (!selected) unhighlight(nodeEl, linkEl, chatDimRect, svg);
    }, 180);
  })
  .on("touchstart", (e, d) => {
    if (window.innerWidth >= 640) return;
    // Long-press for tooltip on mobile
    const timer = setTimeout(() => {
        showNodeTip(tip, e, d);
        if (navigator.vibrate) navigator.vibrate(20);
    }, 500);
    d3.select(e.currentTarget).on("touchend touchmove", () => clearTimeout(timer), {once:true});
  })
  .on("click", (e, d) => {
    e.stopPropagation();
    // Hide tooltips on click if they was open
    tip.classed("show", false);
    linkTip.classed("show", false);

    if (selected === d.id) {
      selected = null;
      unhighlight(nodeEl, linkEl, chatDimRect, svg);
      closeNodeDetail();
    } else {
      selected = d.id;
      highlight(d, nodeEl, linkEl, linkData);
      openNodeDetail(d, linkData, nmap, window._G);
    }
    // Re-render rankings if panel is open (perspective mode depends on selection)
    if (rankingsPanelOpen) _renderRankings();
  })
  .on("dblclick", (e, d) => {
    const u = d.url || (d.doi ? `https://doi.org/${d.doi}` : null);
    if (u) window.open(u, "_blank");
  });

svg.on("click", () => {
  if (selected) {
    selected = null;
    unhighlight(nodeEl, linkEl, chatDimRect, svg);
    tip.classed("show", false);
    closeNodeDetail();
    if (rankingsPanelOpen) _renderRankings();
  }
});

// ── Simulation tick ────────────────────────────────────────────────────────
sim.on("tick", () => {
  const updateLine = sel => sel
    .attr("x1", l => l.source.x).attr("y1", l => l.source.y)
    .attr("x2", l => l.target.x).attr("y2", l => l.target.y);
  updateLine(linkEl);
  updateLine(linkHit);
  nodeEl.attr("transform", d => `translate(${d.x},${d.y})`);
  if (hullsVisible) redrawHulls();
});

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  window._W = window.innerWidth; window._H = window.innerHeight;
  svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  sim.force("center", d3.forceCenter(window.innerWidth/2, window.innerHeight/2)).alpha(0.1).restart();
});

// ── Filters & search ───────────────────────────────────────────────────────
bindFilterButtons(nodeEl, linkEl, nmap);
bindSearch(nodeEl, linkEl, nodes);

// ── Stats ──────────────────────────────────────────────────────────────────
document.getElementById("sn").textContent = OLI.length;
document.getElementById("sa").textContent = nodes.filter(n => !n.isOli).length;
document.getElementById("se").textContent = linkData.length;

// ═══════════════════════════════════════════════════════════
// GRAPH METRICS
// ═══════════════════════════════════════════════════════════

let _idxOf = {};

function computeAllMetrics() {
  const c = computeCentrality(nodes, LINKS);
  if (!c) return;
  const { idxOf, deg, pr, bc, cl } = c;
  _idxOf = idxOf;

  const { eqB, eqD, eqU, ep } = computeGlobalEQBSL(nodes, LINKS, idxOf);

  const nDeg  = normArr(deg);
  const nPR   = normArr(pr);
  const nBC   = normArr(bc);
  const nCL   = normArr(cl);
  const nEP   = normArr(ep);
  const comp  = nodes.map((_, i) => (nDeg[i] + nPR[i] + nBC[i] + nCL[i] + nEP[i]) / 5);
  const nComp = normArr(comp);

  nodes.forEach((n, i) => {
    n._m = {
      degree:   deg[i],  normDeg:  nDeg[i],
      pagerank: pr[i],   normPR:   nPR[i],
      between:  bc[i],   normBC:   nBC[i],
      close:    cl[i],   normCL:   nCL[i],
      eqbslB:   eqB[i], eqbslD:   eqD[i], eqbslU: eqU[i],
      eqbslEP:  ep[i],   normEP:   nEP[i],
      composite: comp[i], normComp: nComp[i],
    };
  });

  function sortedBy(key) { return nodes.slice().sort((a,b) => (b._m[key]||0) - (a._m[key]||0)); }
  const lists = {
    overall:  sortedBy('composite'),
    eqbsl:    sortedBy('eqbslEP'),
    pagerank: sortedBy('pagerank'),
    degree:   sortedBy('degree'),
    between:  sortedBy('between'),
    close:    sortedBy('close'),
  };
  Object.entries(lists).forEach(([key, sorted]) => {
    sorted.forEach((n, i) => { n._m['rank_' + key] = i + 1; });
  });
  window._G = { ...lists, N: nodes.length };

  // Run advanced metrics and attach to nodes
  const constraint  = computeBurtConstraint(nodes, LINKS, nmap);
  const egoDensity  = computoEgoDensity(nodes, LINKS, nmap);
  const { communities, modularity } = detectCommunities(nodes, LINKS);

  nodes.forEach(n => {
    n._constraint  = constraint.get(n.id)  ?? 1;
    n._egoDensity  = egoDensity.get(n.id)  ?? 0;
    n._community   = communities.get(n.id) ?? -1;
  });

  console.log(`[metrics] Louvain modularity Q=${modularity.toFixed(4)}, ${communities.size} communities`);
}

computeAllMetrics();

// ═══════════════════════════════════════════════════════════
// DUAL PANELS — Rankings (LEFT) + Chat (RIGHT)
// ═══════════════════════════════════════════════════════════

let rankingsPanelOpen = false;
let chatPanelOpen     = false;

/* ── Responsive BottomSheet management ──
   Create / destroy sheets when crossing the 640px breakpoint
   so orientation changes work correctly.                       */
let bsRankings = null, bsChat = null;
const mobileQuery = window.matchMedia('(max-width: 639px)');

function _isMobile() { return mobileQuery.matches; }
function _panelIsOpen(id) {
  return document.getElementById(id)?.classList.contains('open');
}

function _createSheets() {
  if (bsRankings) return; // already created
  bsRankings = new BottomSheet('rankingsPanel', {
    onClose: () => {
      rankingsPanelOpen = false;
      document.getElementById('rankingsToggle')?.classList.remove('active');
    }
  });
  bsChat = new BottomSheet('chatPanel', {
    onClose: () => {
      chatPanelOpen = false;
      const chatEl = document.getElementById('chatPanel');
      if (chatEl) {
        chatEl.style.height = '';
        chatEl.style.bottom = '';
      }
      document.getElementById('chatToggle')?.classList.remove('active');
    }
  });
}

function _destroySheets() {
  if (bsRankings) { bsRankings.destroy(); bsRankings = null; }
  if (bsChat)     { bsChat.destroy();     bsChat     = null; }
}

function _onBreakpointChange(e) {
  if (e.matches) {
    // Entering mobile — create sheets, close any desktop-open panels first
    if (rankingsPanelOpen) document.getElementById('rankingsPanel').classList.remove('open');
    if (chatPanelOpen) document.getElementById('chatPanel').classList.remove('open');
    rankingsPanelOpen = false; chatPanelOpen = false;
    document.getElementById('rankingsToggle')?.classList.remove('active');
    document.getElementById('chatToggle')?.classList.remove('active');
    _createSheets();
  } else {
    // Leaving mobile — destroy sheets, close any mobile-open panels
    _destroySheets();
    if (rankingsPanelOpen) document.getElementById('rankingsPanel').classList.remove('open');
    if (chatPanelOpen) document.getElementById('chatPanel').classList.remove('open');
    rankingsPanelOpen = false; chatPanelOpen = false;
    document.getElementById('rankingsToggle')?.classList.remove('active');
    document.getElementById('chatToggle')?.classList.remove('active');
  }
}

// Initialise for the current viewport
if (_isMobile()) _createSheets();
mobileQuery.addEventListener('change', _onBreakpointChange);

function _renderRankings() {
  renderRankings({
    G: window._G, nodes, links: LINKS, idxOf: _idxOf, nmap, selected,
    jumpFromRankings: id => {
      const n = nmap[id]; if (!n) return;
      selected = id; highlight(n, nodeEl, linkEl, linkData);
      openNodeDetail(n, linkData, nmap, window._G);
      _focusNode(id);
    }
  });
}

window._jumpFromRankings = id => {
  const n = nmap[id]; if (!n) return;
  selected = id; highlight(n, nodeEl, linkEl, linkData);
  openNodeDetail(n, linkData, nmap, window._G);
  _focusNode(id);
};

function openRankingsPanel() {
  rankingsPanelOpen = true;
  if (_isMobile() && bsRankings) bsRankings.open();
  else document.getElementById('rankingsPanel').classList.add('open');
  document.getElementById('rankingsToggle').classList.add('active');
  _renderRankings();
}

function closeRankingsPanel() {
  rankingsPanelOpen = false;
  if (_isMobile() && bsRankings) bsRankings.close();
  else document.getElementById('rankingsPanel').classList.remove('open');
  document.getElementById('rankingsToggle').classList.remove('active');
}

function openChatPanel() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  chatPanelOpen = true;
  if (_isMobile() && bsChat) bsChat.open();
  else panel.classList.add('open');
  // If mobile menu is open, close it so chat is the only active surface.
  document.getElementById('controls')?.classList.remove('open');
  document.body.classList.remove('menu-open');
  document.getElementById('chatToggle').classList.add('active');
  document.getElementById('chatInput').focus();
}

function closeChatPanel() {
  const chatEl = document.getElementById('chatPanel');
  if (!chatEl) return;
  chatPanelOpen = false;
  if (_isMobile() && bsChat) bsChat.close();
  else chatEl.classList.remove('open');
  chatEl.style.height = '';
  chatEl.style.bottom = '';
  document.getElementById('chatToggle').classList.remove('active');
}

window.toggleChat = () => {
  if (_panelIsOpen('chatPanel')) closeChatPanel();
  else openChatPanel();
};
window.toggleRankings = () => {
  if (_panelIsOpen('rankingsPanel')) closeRankingsPanel();
  else openRankingsPanel();
};
window.closeChatPanel = closeChatPanel;
window.closeRankingsPanel = closeRankingsPanel;
window.setRankTab = metric => setRankTab(metric, _renderRankings);

// ═══════════════════════════════════════════════════════════
// NODE DETAIL WIRING
// ═══════════════════════════════════════════════════════════

window.closeNodeDetail   = closeNodeDetail;
window.focusNodeInGraph  = () => { if (nodeDetailId) _focusNode(nodeDetailId); };
window._jumpToNode       = id => {
  const n = nmap[id]; if (!n) return;
  closeNodeDetail();
  openNodeDetail(n, linkData, nmap, window._G);
  _focusNode(id);
  selected = id; highlight(n, nodeEl, linkEl, linkData);
};

function _focusNode(id) {
  const n = nmap[id]; if (!n || n.x == null) return;
  const scale=2.0, tx=window._W/2-scale*n.x, ty=window._H/2-scale*n.y;
  svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(tx,ty).scale(scale));
}

// ═══════════════════════════════════════════════════════════
// CHAT WIRING
// ═══════════════════════════════════════════════════════════

window.clearChatActions = () => {
  tempLinks = clearChatActions(nodeEl, linkEl, chatDimRect, svg, g.select('#inferredEdges'));
};

const chatCtx = () => ({
  nodes, nmap, linkData, nodeEl, linkEl, chatDimRect, svg,
  g, tempLinks, linkTip, sim,
  moveLinkTipFn: _moveLinkTipFn,
});

window.sendChat = async function(queryOverride) {
  const input  = document.getElementById('chatInput');
  const query  = queryOverride || input.value.trim(); if (!query) return;
  const busyEl = document.getElementById('chatSend');
  busyEl.disabled = true; if (!queryOverride) input.value = '';
  addMsg('user', query.replace(/</g,'&lt;'));
  const thinking = addMsg('thinking', '⟳ Thinking…');
  try {
    const result   = await callGraphLLM(query, chatHistory, OLI, CITED, ARXIV, ZENODO_KW, chatMode);
    thinking.remove();

    let highlightIds = [];
    let tagHtml = '';

    if (chatMode === 'graph' && result.actions?.length) {
      const executed = executeActions(result.actions, chatCtx());
      // Collect all highlighted node IDs from executed actions
      highlightIds = [...new Set((result.actions || []).flatMap(a =>
        a.ids || a.nodes || [a.from, a.to, a.id, a.id1, a.id2].filter(Boolean)
      ).map(id => {
        const resolved = window._nmap[id] ? id : null;
        return resolved;
      }).filter(Boolean))];
      tagHtml = executed.map(a =>
        `<span class="ch-action-tag" style="background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.label}</span>`
      ).join('');
      if (executed.length) saveSession(nodes, linkData, STATIC_EDGE_COUNT, tempLinks);
    }

    const msgEl = addMsg('assistant', `
      <div class="ch-narrative">${(result.narrative||'Done.').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
      ${tagHtml ? `<div class="ch-actions">${tagHtml}</div>` : ''}
    `);

    // Attach hover-to-re-highlight on this bubble
    if (highlightIds.length) {
      attachBubbleHighlight(msgEl, highlightIds, {
        nodeEl, linkEl, linkData, chatDimRect, svg
      });
    }

    chatHistory.push({role:'user',content:query});
    chatHistory.push({role:'assistant',content:result.narrative||''});
  } catch(err) {
    thinking.remove();
    addMsg('error', `⚠ ${(err.message||'AI error').replace(/</g,'&lt;')}`);
  }
  busyEl.disabled = false;
  document.getElementById('chatInput').focus();
};

// Regenerate: re-send the last user query
window._regenerateLastChat = function() {
  // Find the last user message in history
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    if (chatHistory[i].role === 'user') {
      window.sendChat(chatHistory[i].content);
      return;
    }
  }
};

// Chat mode toggle UI
window.setChatModeUI = function(mode) {
  setChatMode(mode);
  document.querySelectorAll('.ch-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
};

document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendChat(); }
});

// ── Mobile: resize chat panel when virtual keyboard opens ──────────────────
if (window.visualViewport) {
  const _chatPanel = document.getElementById('chatPanel');
  const _chatInput = document.getElementById('chatInput');
  const _syncChatViewport = () => {
    if (chatPanelOpen && _isMobile()) {
      const vv = window.visualViewport;
      const vvH = vv.height;
      const keyboardLikelyOpen = vvH < (window.innerHeight - 80);
      const inputFocused = document.activeElement === _chatInput;
      if (keyboardLikelyOpen && inputFocused) {
        const keyboardInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        const nextH = Math.max(320, Math.min(vvH - 48, window.innerHeight * 0.85));
        _chatPanel.style.height = `${nextH}px`;
        _chatPanel.style.bottom = `${keyboardInset}px`;
      } else {
        _chatPanel.style.height = '';
        _chatPanel.style.bottom = '';
      }
    }
  };
  window.visualViewport.addEventListener('resize', _syncChatViewport);
  window.visualViewport.addEventListener('scroll', _syncChatViewport);
  _chatInput.addEventListener('blur', () => {
    _chatPanel.style.height = '';
    _chatPanel.style.bottom = '';
  });
}

// ── Model persistence ─────────────────────────────────────────────────────
const savedModel = localStorage.getItem('kg_model');
const _modelInput = document.getElementById('modelInput');
if (savedModel) _modelInput.value = savedModel;
setModel(_modelInput.value.trim());

_modelInput.addEventListener('input', function() {
  const val = this.value.trim();
  setModel(val);
  localStorage.setItem('kg_model', val);
});

// ── Populate model dropdown with free OpenRouter models ────────────────────
fetchFreeModels().then(models => {
  if (!models.length) return; // keep existing datalist if fetch fails
  const dl = document.getElementById('modelList');
  dl.innerHTML = models
    .map(m => `<option value="${m.id}">${m.name || m.id}</option>`)
    .join('\n');
  console.info(`[models] ${models.length} free models loaded from OpenRouter`);
});

// ═══════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════

/** Clear all persisted session data and reload the graph fresh. */
window.clearSessionData = function() {
  clearSession();
  console.info('[session] Cleared. Reloading…');
  location.reload();
};

/** Print a human-readable summary of stored session data. */
window.sessionSummary = () => console.info(sessionSummary());

// ═══════════════════════════════════════════════════════════
// ADD PAPER
// ═══════════════════════════════════════════════════════════

window.toggleAddPanel = () => {
  const p = document.getElementById('addPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  if (p.style.display === 'block') document.getElementById('addInput').focus();
};

function setAddStatus(msg, color) {
  const el = document.getElementById('addStatus');
  el.style.color = color || '#556080';
  el.textContent = msg;
}

window.addPaperFromUrl = async function() {
  const raw = document.getElementById('addInput').value.trim();
  if (!raw) { setAddStatus('Please enter a DOI, arXiv ID, or URL.', '#f08060'); return; }
  setAddStatus('Fetching metadata…', '#8ab4ff');
  const { meta, error } = await fetchMetaFromInput(raw);
  if (!meta) { setAddStatus(error || 'Could not fetch metadata.', '#f08060'); return; }

  if (nodes.some(n => n.doi && n.doi === meta.doi && meta.doi)) {
    setAddStatus('This paper is already in the graph!', '#f0c040'); return;
  }

  setAddStatus(`Classifying "${meta.title.slice(0,40)}…"`, '#8ab4ff');
  const cls  = await classifyWithLLM(meta, OLI, CITED, ARXIV, nmap);
  const uid  = 'dyn_' + Date.now().toString(36);
  const newNode = {
    id: uid, cluster: cls.cluster||'trust',
    title: meta.title, short: meta.title.slice(0,38)+(meta.title.length>38?'...':''),
    authors: meta.authors||['Unknown'], year: meta.year||2024,
    abstract: (meta.abstract||'').slice(0,400), tags: cls.tags||[],
    url: meta.url||'', doi: meta.doi||'', r:10, src: meta.src||'external', isOli: false,
    x: W/2+(Math.random()-0.5)*200, y: H/2+(Math.random()-0.5)*200,
  };
  nodes.push(newNode); nmap[uid] = newNode;
  const newLinks = (cls.edges||[]).filter(e=>e.target&&nmap[e.target])
    .map(e => ({source:uid, target:e.target, type:e.type||'similar'}));
  if (!newLinks.length) newLinks.push({source:uid, target:{trust:'eqbsl',consciousness:'godelos',crypto:'bitcoll',collective:'plenum'}[cls.cluster]||'eqbsl', type:'similar'});
  newLinks.forEach(l => linkData.push(l));

  sim.nodes(nodes);
  rerenderLinks(linkG, linkHitG, linkData, nmap,
    (e, l) => { showLinkTip(linkTip, e, l, nmap); tip.classed("show",false); },
    _moveLinkTipFn,
    () => linkTip.classed("show",false)
  );
  sim.force('link').links(linkData);
  sim.alpha(0.4).restart();

  document.getElementById('sa').textContent = nodes.filter(n=>!n.isOli).length;
  document.getElementById('se').textContent = linkData.length;
  setAddStatus(`✓ Added "${meta.title.slice(0,40)}" — ${cls.cluster}. ${cls.reason||''}`, '#5ecfa0');
  document.getElementById('addInput').value = '';
  saveSession(nodes, linkData, STATIC_EDGE_COUNT, tempLinks);
};

// ═══════════════════════════════════════════════════════════
// AI EDGES WIRING
// ═══════════════════════════════════════════════════════════

window.batchAIEdges = async () => {
  await batchAIEdges({
    OLI, CITED, ARXIV, ZENODO_KW, nodes, nmap, linkData,
    linkG, linkHitG, sim,
    onLinkOver:  (e, l) => { showLinkTip(linkTip, e, l, nmap); tip.classed("show",false); },
    onLinkMove:  _moveLinkTipFn,
    onLinkOut:   () => linkTip.classed("show",false),
  });
  saveSession(nodes, linkData, STATIC_EDGE_COUNT, tempLinks);
};

// ═══════════════════════════════════════════════════════════
// LAYOUT TOGGLES
// ═══════════════════════════════════════════════════════════

window.toggleSpectral = function() {
  const btn = document.getElementById('spectralBtn');
  if (btn.classList.contains('active')) {
    releaseSpectralLayout(nodes);
    sim.alpha(0.3).restart();
    btn.classList.remove('active');
    btn.textContent = '⬡ Spectral';
  } else {
    spectralLayout(nodes, LINKS, window._W, window._H);
    sim.alpha(0.1).restart();
    btn.classList.add('active');
    btn.textContent = '⟳ Physics';
  }
};

window.toggleHulls = function() {
  hullsVisible = !hullsVisible;
  hullG.style('display', hullsVisible ? null : 'none');
  document.getElementById('hullsBtn').classList.toggle('active', hullsVisible);
  if (hullsVisible) redrawHulls();
};

// ═══════════════════════════════════════════════════════════
// SYNTHESIS PANEL (quick trigger)
// ═══════════════════════════════════════════════════════════

window.synthesiseSelected = async function() {
  if (!selected) return;
  const sn = nmap[selected]; if (!sn) return;
  const clusterNodes = nodes.filter(n => n.cluster === sn.cluster);
  addMsg('thinking', `⟳ Synthesising ${sn.cluster} cluster…`);
  try {
    const result = await synthesiseSubgraph(clusterNodes, nodes, LINKS, nmap, 12);
    const thinking = document.querySelector('.chat-msg.thinking');
    thinking?.remove();
    addMsg('assistant', `
      <div class="ch-narrative"><strong>${sn.cluster} synthesis</strong><br>${result.summary}</div>
      ${result.keyInsight ? `<div class="ch-narrative" style="color:#8ab4ff;margin-top:6px">Key insight: ${result.keyInsight}</div>` : ''}
      ${result.tensions?.length ? `<div class="ch-narrative" style="color:#f0a040;margin-top:6px">Tensions: ${result.tensions.map(t=>t.description).join(' · ')}</div>` : ''}
    `);
    if (!chatPanelOpen) openChatPanel();
  } catch(e) {
    addMsg('error', `⚠ Synthesis failed: ${e.message}`);
  }
};

// ═══════════════════════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════

function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'theme-dark' ? '🌙' : '☀️';
  // Update graph canvas background for light mode
  const dimRect = document.getElementById('chatDimRect');
  if (dimRect) {
    d3.select(dimRect).attr('fill', theme === 'theme-light' ? 'rgb(244,245,248)' : 'rgb(0,3,12)');
  }
  localStorage.setItem('kg_theme', theme);
}

window.toggleTheme = function() {
  const current = document.body.classList.contains('theme-light') ? 'theme-light' : 'theme-dark';
  applyTheme(current === 'theme-dark' ? 'theme-light' : 'theme-dark');
};

// Restore saved theme
const savedTheme = localStorage.getItem('kg_theme') || 'theme-dark';
applyTheme(savedTheme);

// ═══════════════════════════════════════════════════════════
// COMMAND PALETTE (Cmd-K)
// ═══════════════════════════════════════════════════════════

const CMDK_ACTIONS = [
  { icon: '💬', label: 'Open Chat',          action: () => window.toggleChat(),    hint: '' },
  { icon: '📊', label: 'Open Rankings',      action: () => window.toggleRankings(), hint: '' },
  { icon: '＋', label: 'Add Paper',           action: () => window.toggleAddPanel(), hint: '' },
  { icon: '🤖', label: 'Generate AI Edges',  action: () => window.batchAIEdges(),  hint: '' },
  { icon: '⬡',  label: 'Toggle Hulls',       action: () => window.toggleHulls(),   hint: '' },
  { icon: '⬡',  label: 'Toggle Spectral',    action: () => window.toggleSpectral(), hint: '' },
  { icon: '🌓', label: 'Toggle Theme',       action: () => window.toggleTheme(),   hint: '' },
  { icon: '🗑', label: 'Clear Session Data', action: () => window.clearSessionData(), hint: '' },
  { icon: '🧹', label: 'Clear Chat Highlights', action: () => window.clearChatActions(), hint: '' },
];

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 2;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

function buildCmdKResults(query) {
  const container = document.getElementById('cmdKResults');
  container.innerHTML = '';
  const q = query.trim();

  // Actions
  const matchedActions = CMDK_ACTIONS
    .map(a => ({ ...a, score: q ? fuzzyMatch(q, a.label) : 1 }))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matchedActions.length) {
    const grp = document.createElement('div');
    grp.className = 'cmdk-group-label';
    grp.textContent = 'Actions';
    container.appendChild(grp);
    matchedActions.forEach(a => {
      const el = document.createElement('div');
      el.className = 'cmdk-item';
      el.innerHTML = `<span class="cmdk-item-icon">${a.icon}</span><span class="cmdk-item-label">${a.label}</span>${a.hint ? `<span class="cmdk-item-hint">${a.hint}</span>` : ''}`;
      el.addEventListener('click', () => { closeCmdK(); a.action(); });
      container.appendChild(el);
    });
  }

  // Papers
  if (q.length >= 2) {
    const matchedPapers = nodes
      .map(n => ({ n, score: fuzzyMatch(q, n.title || n.short || n.id) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    if (matchedPapers.length) {
      const grp = document.createElement('div');
      grp.className = 'cmdk-group-label';
      grp.textContent = 'Papers';
      container.appendChild(grp);
      matchedPapers.forEach(({ n }) => {
        const el = document.createElement('div');
        el.className = 'cmdk-item';
        const clusterIcon = { consciousness: '🧠', trust: '🔗', crypto: '🔐', collective: '🌐' }[n.cluster] || '📄';
        el.innerHTML = `<span class="cmdk-item-icon">${clusterIcon}</span><span class="cmdk-item-label">${n.title || n.short || n.id}</span><span class="cmdk-item-hint">${n.year || ''}</span>`;
        el.addEventListener('click', () => {
          closeCmdK();
          window._jumpToNode(n.id);
        });
        container.appendChild(el);
      });
    }
  }

  // Keyboard nav — highlight first item
  const items = container.querySelectorAll('.cmdk-item');
  if (items.length) items[0].classList.add('active');
}

function closeCmdK() {
  const overlay = document.getElementById('cmdKOverlay');
  overlay.classList.remove('open');
  document.getElementById('cmdKInput').value = '';
  document.getElementById('cmdKResults').innerHTML = '';
}

window.toggleCmdK = function() {
  const overlay = document.getElementById('cmdKOverlay');
  if (overlay.classList.contains('open')) {
    closeCmdK();
  } else {
    overlay.classList.add('open');
    const input = document.getElementById('cmdKInput');
    input.value = '';
    input.focus();
    buildCmdKResults('');
  }
};

// Cmd-K input handling
document.getElementById('cmdKInput').addEventListener('input', function() {
  buildCmdKResults(this.value);
});
document.getElementById('cmdKInput').addEventListener('keydown', function(e) {
  const items = document.querySelectorAll('#cmdKResults .cmdk-item');
  const active = document.querySelector('#cmdKResults .cmdk-item.active');
  const idx = active ? Array.from(items).indexOf(active) : -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (active) active.classList.remove('active');
    const next = items[(idx + 1) % items.length];
    if (next) { next.classList.add('active'); next.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (active) active.classList.remove('active');
    const prev = items[(idx - 1 + items.length) % items.length];
    if (prev) { prev.classList.add('active'); prev.scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (active) active.click();
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter → send text to chat
    e.preventDefault();
    const q = this.value.trim();
    if (!q) return;
    closeCmdK();
    if (!chatPanelOpen) openChatPanel();
    window.sendChat(q);
  }
});
document.getElementById('cmdKOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeCmdK();
});

// ═══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Close in priority order: CmdK → Mobile menu → Panels
    const cmdK = document.getElementById('cmdKOverlay');
    if (cmdK && cmdK.classList.contains('open')) { cmdK.classList.remove('open'); return; }
    const nav = document.getElementById('controls');
    if (nav.classList.contains('open')) {
      nav.classList.remove('open');
      document.body.classList.remove('menu-open');
      return;
    }
    closeNodeDetail();
    if (rankingsPanelOpen) closeRankingsPanel();
    if (chatPanelOpen) closeChatPanel();
  }
  // Cmd/Ctrl + K → Command palette
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.toggleCmdK();
  }
});
