// ═══════════════════════════════════════════════════════════
// CHAT PANEL — Natural Language Graph Explorer
// ═══════════════════════════════════════════════════════════
import { fuzzyFindNode, bfsPath, getNeighborhood } from '../graph/interaction.js';

export let chatOpen = false;
export let chatBusy = false;
export const chatHistory = [];
export let chatMode = 'graph';   // 'graph' | 'query'

export function setChatMode(mode) { chatMode = mode; }

export function toggleChat() {
  chatOpen = !chatOpen;
  // Panel open/close managed by chatPanel in main.js
  if (chatOpen) {
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  }
}

export function addMsg(role, html, extraClass) {
  const msgs = document.getElementById('chatMessages');
  const div  = document.createElement('div');
  div.className = `chat-msg ${role}${extraClass?' '+extraClass:''}`;
  div.innerHTML  = html;

  // Copy + Regenerate toolbar for assistant messages
  if (role === 'assistant') {
    const toolbar = document.createElement('div');
    toolbar.className = 'ch-msg-toolbar';
    toolbar.innerHTML = `
      <button class="ch-msg-btn" data-action="copy" title="Copy to clipboard">⎘ Copy</button>
      <button class="ch-msg-btn" data-action="regen" title="Regenerate response">↻ Regen</button>
    `;
    toolbar.querySelector('[data-action="copy"]').addEventListener('click', () => {
      const narrative = div.querySelector('.ch-narrative');
      const text = narrative ? narrative.textContent : div.textContent;
      navigator.clipboard.writeText(text.trim()).then(() => {
        const btn = toolbar.querySelector('[data-action="copy"]');
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = '⎘ Copy', 1500);
      });
    });
    toolbar.querySelector('[data-action="regen"]').addEventListener('click', () => {
      const btn = toolbar.querySelector('[data-action="regen"]');
      if (!btn || btn.disabled) return;
      const prev = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '⟳…';
      Promise.resolve(window._regenerateLastChat?.())
        .catch(() => {})
        .finally(() => {
          btn.classList.remove('loading');
          btn.disabled = false;
          btn.textContent = prev;
        });
    });
    div.appendChild(toolbar);
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

/**
 * Attach highlight-on-hover behavior to a chat message element.
 * @param {HTMLElement} msgEl — the .chat-msg div
 * @param {string[]} highlightIds — node IDs to highlight
 * @param {object} ctx — {nodeEl, linkEl, linkData, chatDimRect, svg}
 */
export function attachBubbleHighlight(msgEl, highlightIds, ctx) {
  if (!highlightIds || !highlightIds.length) return;
  msgEl.dataset.highlightIds = JSON.stringify(highlightIds);
  msgEl.classList.add('ch-hoverable');
  msgEl.addEventListener('mouseenter', () => {
    chatHighlightNodes(highlightIds, ctx.nodeEl, ctx.linkEl, ctx.linkData, ctx.chatDimRect, ctx.svg);
  });
  msgEl.addEventListener('mouseleave', () => {
    // Only unhighlight if no other interaction is active
    chatHighlightNodes([], ctx.nodeEl, ctx.linkEl, ctx.linkData, ctx.chatDimRect, ctx.svg);
  });
}

// ── Visual chat helpers ────────────────────────────────────────────────────
export function chatHighlightNodes(ids, nodeEl, linkEl, linkData, chatDimRect, svg) {
  if (!ids || ids.length === 0) {
    nodeEl.classed('faded', false);
    linkEl.classed('faded', false);
    chatDimRect?.transition().duration(350).attr('fill-opacity', 0);
    svg?.classed('chat-subgraph', false);
    return;
  }
  const idSet = new Set(ids);
  ids.forEach(id => {
    linkData.forEach(l => {
      const s = l.source?.id||l.source, t = l.target?.id||l.target;
      if (s === id) idSet.add(t);
      if (t === id) idSet.add(s);
    });
  });
  nodeEl.classed('faded', n => !idSet.has(n.id));
  linkEl.classed('faded', l => {
    const s = l.source?.id||l.source, t = l.target?.id||l.target;
    return !(idSet.has(s) && idSet.has(t));
  });
  chatDimRect?.transition().duration(350).attr('fill-opacity', 0.84);
  svg?.classed('chat-subgraph', true);
}

export function chatFocusNode(id, nmap, svg, zoom, W, H) {
  const n = nmap[id]; if (!n || n.x == null) return;
  const scale = 2.0;
  const tx = W/2 - scale*n.x, ty = H/2 - scale*n.y;
  svg.transition().duration(700).call(
    zoom.transform,
    window._d3.zoomIdentity.translate(tx, ty).scale(scale)
  );
}

export function clearChatActions(nodeEl, linkEl, chatDimRect, svg, inferredEdgeGroup) {
  nodeEl.classed('faded', false);
  linkEl.classed('faded', false).classed('lit', false);
  chatDimRect?.transition().duration(400).attr('fill-opacity', 0);
  svg?.classed('chat-subgraph', false);
  if (inferredEdgeGroup) inferredEdgeGroup.selectAll('*').remove();
  return [];
}

// ── Inferred edges ─────────────────────────────────────────────────────────
export function renderInferred(g, tempLinks, nmap, linkTip, sim, moveLinkTipFn) {
  let inferredEdgeGroup = g.select('#inferredEdges');
  if (inferredEdgeGroup.empty()) {
    inferredEdgeGroup = g.append('g').attr('id','inferredEdges');
  }

  inferredEdgeGroup.selectAll('line.inferred').data(tempLinks, (_, i) => i)
    .join('line')
    .attr('class','link inferred')
    .attr('stroke','#c8901a').attr('stroke-width',2.2)
    .attr('stroke-dasharray','7,4').attr('stroke-opacity',0.8)
    .attr('x1', l => (nmap[l.source?.id||l.source]||{}).x||0)
    .attr('y1', l => (nmap[l.source?.id||l.source]||{}).y||0)
    .attr('x2', l => (nmap[l.target?.id||l.target]||{}).x||0)
    .attr('y2', l => (nmap[l.target?.id||l.target]||{}).y||0)
    .on('mouseover', (e, l) => {
      const sid = l.source?.id||l.source, tid = l.target?.id||l.target;
      linkTip.html(`
        <div class="ltype" style="color:#c8901a">INFERRED</div>
        <div class="lpath">${nmap[sid]?.short||sid} → ${nmap[tid]?.short||tid}</div>
        <div class="lroot">AI-inferred conceptual connection</div>
        ${l.reason?`<div class="lreason">🤖 ${l.reason}</div>`:''}
      `).classed('show', true);
      moveLinkTipFn(e);
    })
    .on('mousemove', e => moveLinkTipFn(e))
    .on('mouseout', () => linkTip.classed('show', false));

  // Hook tick for live position updates
  if (!renderInferred._hooked) {
    renderInferred._hooked = true;
    sim?.on('tick.inferred', () => {
      const ig = g.select('#inferredEdges');
      if (!ig.empty()) {
        ig.selectAll('line.inferred')
          .attr('x1', l => (nmap[l.source?.id||l.source]||{}).x||0)
          .attr('y1', l => (nmap[l.source?.id||l.source]||{}).y||0)
          .attr('x2', l => (nmap[l.target?.id||l.target]||{}).x||0)
          .attr('y2', l => (nmap[l.target?.id||l.target]||{}).y||0);
      }
    });
  }

  return inferredEdgeGroup;
}

// ── Action executor ────────────────────────────────────────────────────────
export function executeActions(actions, ctx) {
  const { nodes, nmap, linkData, nodeEl, linkEl, chatDimRect, svg,
          g, tempLinks, linkTip, sim, moveLinkTipFn } = ctx;
  const executed = [];
  let highlightIds = [];

  actions.forEach(act => {
    switch(act.type) {
      case 'highlight_nodes': {
        const ids = (act.ids||act.nodes||[])
          .map(id => fuzzyFindNode(id, nodes, nmap) || id)
          .filter(id => nmap[id]);
        highlightIds.push(...ids);
        executed.push({ label:`Highlighted ${ids.length} nodes`, color:'#5ecfa0' });
        break;
      }
      case 'show_path': {
        const f = fuzzyFindNode(act.from, nodes, nmap) || act.from;
        const t = fuzzyFindNode(act.to,   nodes, nmap) || act.to;
        const result = bfsPath(f, t, 8, linkData);
        if (result) {
          highlightIds.push(...result.nodes);
          executed.push({ label:`Path (${result.nodes.length} hops): ${result.nodes.map(id=>nmap[id]?.short||id).join(' → ')}`, color:'#8ab4ff' });
        } else {
          if (nmap[f] && nmap[t]) {
            tempLinks.push({source:f, target:t, type:'similar', reason:act.reason||'Conceptual bridge (no direct path found)'});
            renderInferred(g, tempLinks, nmap, linkTip, sim, moveLinkTipFn);
            highlightIds.push(f, t);
          }
          executed.push({ label:`No path found — inferred bridge added`, color:'#f0a040' });
        }
        if (nmap[f]) chatFocusNode(f, nmap, svg, window._zoom, window._W, window._H);
        break;
      }
      case 'find_bridges': {
        const id1 = fuzzyFindNode(act.id1||act.from||act.node1||act.a||'', nodes, nmap) || (act.id1||'');
        const id2 = fuzzyFindNode(act.id2||act.to  ||act.node2||act.b||'', nodes, nmap) || (act.id2||'');
        const n1  = getNeighborhood(id1, 2, linkData);
        const n2  = getNeighborhood(id2, 2, linkData);
        const bridges = [...n1].filter(id => n2.has(id) && id !== id1 && id !== id2 && nmap[id]);
        highlightIds.push(...[id1, id2, ...bridges.slice(0,25)].filter(id => nmap[id]));
        const label = bridges.length === 0
          ? `No shared bridges found between "${nmap[id1]?.short||id1}" and "${nmap[id2]?.short||id2}"`
          : `${bridges.length} bridges: ${bridges.slice(0,4).map(id=>nmap[id]?.short||id).join(', ')}${bridges.length>4?'…':''}`;
        executed.push({ label, color:'#b07dff' });
        if (nmap[id1]) chatFocusNode(id1, nmap, svg, window._zoom, window._W, window._H);
        break;
      }
      case 'add_inferred_edges': {
        let added = 0;
        (act.edges||[]).forEach(e => {
          const s = fuzzyFindNode(e.source||e.s||e.from||e.node1||e.a||'', nodes, nmap) || '';
          const t = fuzzyFindNode(e.target||e.t||e.to  ||e.node2||e.b||'', nodes, nmap) || '';
          if (nmap[s] && nmap[t] && s !== t) {
            tempLinks.push({source:s, target:t, type:e.type||'similar', reason:e.reason||''});
            highlightIds.push(s, t); added++;
          }
        });
        renderInferred(g, tempLinks, nmap, linkTip, sim, moveLinkTipFn);
        executed.push({ label:`+${added} inferred edges (gold dashed)`, color:'#d4a040' });
        break;
      }
      case 'focus_node': {
        const id = fuzzyFindNode(act.id, nodes, nmap) || act.id;
        if (nmap[id]) { chatFocusNode(id, nmap, svg, window._zoom, window._W, window._H); highlightIds.push(id); }
        executed.push({ label:`Focused: ${nmap[id]?.short||id}`, color:'#60c8f0' });
        break;
      }
      case 'filter_cluster': {
        const cl = act.cluster;
        nodeEl.classed('faded', n => n.cluster !== cl && !n.isOli);
        linkEl.classed('faded', l => {
          const s = nmap[l.source?.id||l.source], t = nmap[l.target?.id||l.target];
          return !(s?.cluster===cl || t?.cluster===cl);
        });
        executed.push({ label:`Filtered: ${cl}`, color:'#f0a040' });
        break;
      }
      case 'reset': {
        clearChatActions(nodeEl, linkEl, chatDimRect, svg, g.select('#inferredEdges'));
        tempLinks.length = 0;
        executed.push({ label:'Reset', color:'#4a5878' });
        break;
      }
    }
  });

  if (highlightIds.length) {
    chatHighlightNodes([...new Set(highlightIds)], nodeEl, linkEl, linkData, chatDimRect, svg);
  }
  return executed;
}
