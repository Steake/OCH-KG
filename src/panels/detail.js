// ═══════════════════════════════════════════════════════════
// NODE DETAIL PANEL
// ═══════════════════════════════════════════════════════════
import { CLUSTER_BADGE, EDGE_COLOR } from '../config.js';
import { BottomSheet } from '../ui/bottom-sheet.js';

let bsDetail = null;
const _detailMQ = window.matchMedia('(max-width: 639px)');

function _initDetailSheet() {
  if (bsDetail) return;
  bsDetail = new BottomSheet('nodeDetail');
}
function _destroyDetailSheet() {
  if (bsDetail) { bsDetail.destroy(); bsDetail = null; }
}

if (_detailMQ.matches) _initDetailSheet();
_detailMQ.addEventListener('change', e => {
  if (e.matches) { _initDetailSheet(); }
  else { _destroyDetailSheet(); }
});

export let nodeDetailOpen = false;
export let nodeDetailId   = null;

export function openNodeDetail(d, linkData, nmap, G) {
  nodeDetailOpen = true;
  nodeDetailId   = d.id;

  if (_detailMQ.matches && bsDetail) bsDetail.open();
  else document.getElementById('nodeDetail').classList.add('open');

  // Meta badges
  const clBadge = CLUSTER_BADGE[d.cluster] || 'src';
  document.getElementById('ndMeta').innerHTML = `
    ${d.isOli ? '<span class="nd-badge oli">✦ Oli</span>' : ''}
    <span class="nd-badge ${clBadge}">${d.cluster || '?'}</span>
    ${d.src ? `<span class="nd-badge src">${d.src}</span>` : ''}
    ${d.year ? `<span class="nd-badge src">${d.year}</span>` : ''}
    ${d.authors?.length ? `<span style="color:#3a4868;font-size:9.5px">${d.authors.slice(0,2).join(', ')}${d.authors.length>2?'…':''}</span>` : ''}
  `;

  document.getElementById('ndTitle').textContent = d.title || d.short || d.id;

  // Abstract
  const absSec = document.getElementById('ndAbstractSection');
  const abs    = document.getElementById('ndAbstract');
  if (d.abstract) {
    const tmp = document.createElement('div');
    tmp.innerHTML = d.abstract;
    abs.textContent = tmp.textContent || tmp.innerText || d.abstract;
    absSec.style.display = '';
  } else {
    absSec.style.display = 'none';
  }

  // Tags
  const tagsSec = document.getElementById('ndTagsSection');
  const tags    = document.getElementById('ndTags');
  if (d.tags?.length) {
    tags.innerHTML = d.tags.map(t => `<span class="nd-tag">${t}</span>`).join('');
    tagsSec.style.display = '';
  } else {
    tagsSec.style.display = 'none';
  }

  // Connections
  const edgeCount = document.getElementById('ndEdgeCount');
  const edgeList  = document.getElementById('ndEdgeList');
  const allEdges  = linkData.filter(l => {
    const s = l.source?.id || l.source, t = l.target?.id || l.target;
    return s === d.id || t === d.id;
  });
  edgeCount.textContent = `(${allEdges.length})`;
  edgeList.innerHTML = allEdges.slice(0, 30).map(l => {
    const s = l.source?.id || l.source, t = l.target?.id || l.target;
    const isOut = s === d.id;
    const otherId = isOut ? t : s;
    const other = nmap[otherId];
    if (!other) return '';
    const etype = l.type || 'cites';
    const ecol  = EDGE_COLOR[etype] || '#4a5480';
    return `<div class="nd-edge" onclick="window._jumpToNode('${otherId}')">
      <span class="nd-edge-type" style="background:${ecol}22;color:${ecol};border:1px solid ${ecol}44">${etype}</span>
      <span class="nd-edge-title">${other.short || other.title || otherId}</span>
      <span class="nd-edge-dir">${isOut?'→':'←'}</span>
    </div>`;
  }).join('');

  // Rankings & metrics
  const rankSec  = document.getElementById('ndRankingsSection');
  const rankList = document.getElementById('ndRankingsList');
  if (G && d._m) {
    const m = d._m, N_ = G.N;
    function metricRow(label, rankKey, normKey, color) {
      const rank = m['rank_' + rankKey] || '?';
      const pct  = Math.round((m[normKey] || 0) * 100);
      return `<div class="nd-metric-row">
        <span class="nd-metric-label">${label}</span>
        <span class="nd-metric-rank">#${rank} <em>of ${N_}</em></span>
        <div class="nd-metric-bar"><div class="nd-metric-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }
    rankList.innerHTML =
      metricRow('Overall',     'overall',  'normComp', '#8ab4ff') +
      metricRow('EQBSL',       'eqbsl',    'normEP',   '#5ecfa0') +
      `<div class="nd-eqbsl-inline">b=${m.eqbslB.toFixed(4)} &nbsp;·&nbsp; u=${m.eqbslU.toFixed(4)} &nbsp;·&nbsp; E[P]=${m.eqbslEP.toFixed(4)}</div>` +
      metricRow('PageRank',    'pagerank', 'normPR',   '#f0a040') +
      metricRow('Degree',      'degree',   'normDeg',  '#60c8f0') +
      metricRow('Betweenness', 'between',  'normBC',   '#b07dff') +
      metricRow('Closeness',   'close',    'normCL',   '#7ae4b8');
    rankSec.style.display = '';
  } else {
    rankSec.style.display = 'none';
  }

  // Open button
  const openBtn = document.getElementById('ndOpenBtn');
  const url = d.url || (d.doi ? 'https://doi.org/'+d.doi : null);
  openBtn.href        = url || '#';
  openBtn.style.display = url ? '' : 'none';

  document.getElementById('nodeDetail').classList.add('open');
}

export function closeNodeDetail() {
  nodeDetailOpen = false;
  nodeDetailId   = null;
  if (_detailMQ.matches && bsDetail) bsDetail.close();
  else document.getElementById('nodeDetail').classList.remove('open');
}
