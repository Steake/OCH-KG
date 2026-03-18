// ═══════════════════════════════════════════════════════════
// SVG RENDERING — nodes, links, cluster hulls, inferred edges
// ═══════════════════════════════════════════════════════════
import { CC, OLI_C, LINK_STYLE, EDGE_EPISTEMIC } from '../config.js';

export function buildDefs(svg) {
  const defs = svg.append("defs");

  // Glow filter for Oli nodes
  const gf = defs.append("filter").attr("id","glow").attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
  gf.append("feGaussianBlur").attr("stdDeviation","5").attr("result","blur");
  const fm = gf.append("feMerge");
  fm.append("feMergeNode").attr("in","blur");
  fm.append("feMergeNode").attr("in","SourceGraphic");

  // Radial gradients for Oli nodes
  function makeGrad(id, c1, c2) {
    const rg = defs.append("radialGradient").attr("id", id).attr("cx","40%").attr("cy","35%");
    rg.append("stop").attr("offset","0%").attr("stop-color", c1).attr("stop-opacity","0.4");
    rg.append("stop").attr("offset","100%").attr("stop-color", c2).attr("stop-opacity","0.1");
  }
  makeGrad("grad_oli","#90b8ff","#3060c0");

  return { defs, makeGrad };
}

export function renderLinks(g, linkData, nmap) {
  const linkG   = g.append("g").attr("class","link-layer");
  const linkHitG = g.append("g").attr("class","link-hit-layer");

  const linkEl = linkG.selectAll("line.link")
    .data(linkData).join("line")
    .attr("class","link")
    .attr("stroke", l => (LINK_STYLE[l.type] || LINK_STYLE.cites).color)
    .attr("stroke-width", l => {
      const s = nmap[l.source?.id || l.source];
      const t = nmap[l.target?.id || l.target];
      const base = (LINK_STYLE[l.type] || LINK_STYLE.cites).w;
      return (s?.isOli && t?.isOli) ? base * 2 : base;
    })
    .attr("stroke-dasharray", l => (LINK_STYLE[l.type] || LINK_STYLE.cites).dash)
    .attr("stroke-opacity", l => {
      const sid = l.source?.id || l.source;
      const isZk = typeof sid === 'string' && sid.startsWith('zk_');
      if (l.type === "similar") return isZk ? 0.35 : 0.3;
      return isZk ? 0.55 : 0.6;
    });

  const linkHit = linkHitG.selectAll("line.link-hit")
    .data(linkData).join("line")
    .attr("class","link-hit")
    .attr("stroke","transparent")
    .attr("stroke-width", 10)
    .style("cursor","crosshair");

  return { linkG, linkHitG, linkEl, linkHit };
}

export function renderNodes(g, nodes, OLI, d3) {
  const nodeEl = g.append("g").attr("class","node-layer").selectAll(".node")
    .data(nodes).join("g")
    .attr("class", d => "node" + (d.isOli ? " oli" : ""))
    .call(d3.drag()
      .on("start", (e, d) => { if (!e.active) window._sim?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => { if (!e.active) window._sim?.alphaTarget(0); d.fx = null; d.fy = null; }));

  // Outer glow ring for Oli
  nodeEl.filter(d => d.isOli).append("circle")
    .attr("r", d => d.r + 8)
    .attr("fill","none")
    .attr("stroke", d => CC[d.cluster]?.stroke || OLI_C.stroke)
    .attr("stroke-width", 1)
    .attr("stroke-opacity", 0.2)
    .attr("filter","url(#glow)");

  // Main circle
  nodeEl.append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => d.isOli ? `url(#grad_oli)` : (CC[d.cluster]?.fill || "#888") + "22")
    .attr("stroke", d => d.isOli ? OLI_C.stroke : (CC[d.cluster]?.stroke || "#888"))
    .attr("stroke-width", d => d.isOli ? 2.5 : 1.2)
    .attr("stroke-opacity", d => d.isOli ? 0.85 : 0.5)
    .attr("filter", d => d.isOli ? "url(#glow)" : null);

  // arXiv badge ring
  nodeEl.filter(d => !d.isOli && d.src === "arXiv").append("circle")
    .attr("r", d => d.r + 3).attr("fill","none")
    .attr("stroke","#f0c040").attr("stroke-width",1)
    .attr("stroke-opacity",0.25).attr("stroke-dasharray","2,3");

  // Inner dot for Oli
  nodeEl.filter(d => d.isOli).append("circle")
    .attr("r", 4).attr("fill", OLI_C.stroke).attr("fill-opacity",0.95);

  // Label
  nodeEl.append("text")
    .attr("dy", d => d.r + 12).attr("text-anchor","middle")
    .attr("font-size", d => d.isOli ? "11.5px" : "9px")
    .attr("font-weight", d => d.isOli ? "700" : "400")
    .attr("fill", d => d.isOli ? "#c8d8ff" : "#6878a0")
    .text(d => d.short);

  return nodeEl;
}

/**
 * Draw convex hull outlines behind each cluster.
 * Requires d3.polygonHull.
 */
export function renderClusterHulls(g, nodes, d3) {
  const hullG = g.insert("g", ".link-layer").attr("class","hull-layer");
  const clusterColors = {
    consciousness: '#b07dff', trust: '#5ecfa0',
    crypto: '#f0a040',       collective: '#60c8f0'
  };

  function redraw() {
    const byCluster = {};
    nodes.forEach(n => {
      if (n.x == null) return;
      if (!byCluster[n.cluster]) byCluster[n.cluster] = [];
      byCluster[n.cluster].push([n.x, n.y]);
    });

    const hulls = Object.entries(byCluster).map(([cluster, pts]) => {
      if (pts.length < 3) return null;
      // Pad points outward for a looser hull
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const padded = pts.map(([x, y]) => {
        const dx = x - cx, dy = y - cy;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        return [x + dx/len * 40, y + dy/len * 40];
      });
      const hull = d3.polygonHull(padded);
      return hull ? { cluster, hull } : null;
    }).filter(Boolean);

    hullG.selectAll("path.cluster-hull")
      .data(hulls, d => d.cluster)
      .join("path")
      .attr("class","cluster-hull")
      .attr("fill", d => clusterColors[d.cluster] || '#888')
      .attr("stroke", d => clusterColors[d.cluster] || '#888')
      .attr("d", d => `M${d.hull.join("L")}Z`);
  }

  return { hullG, redraw };
}

/**
 * Re-render a link selection from current linkData.
 * Call after adding new links dynamically.
 */
export function rerenderLinks(linkG, linkHitG, linkData, nmap, onLinkOver, onLinkMove, onLinkOut) {
  linkG.selectAll('line.link').data(linkData).join('line')
    .attr('class', 'link')
    .attr('stroke', l => (LINK_STYLE[l.type] || LINK_STYLE.cites).color)
    .attr('stroke-width', l => {
      const s = nmap[l.source?.id||l.source], t = nmap[l.target?.id||l.target];
      const base = (LINK_STYLE[l.type] || LINK_STYLE.cites).w;
      return (s?.isOli && t?.isOli) ? base * 2 : base;
    })
    .attr('stroke-dasharray', l => (LINK_STYLE[l.type] || LINK_STYLE.cites).dash)
    .attr('stroke-opacity', l => {
      const sid = l.source?.id || l.source;
      const isZk = typeof sid === 'string' && sid.startsWith('zk_');
      return l.type === 'similar' ? (isZk ? 0.35 : 0.3) : (isZk ? 0.55 : 0.6);
    });

  linkHitG.selectAll('line.link-hit').data(linkData).join('line')
    .attr('class','link-hit').attr('stroke','transparent').attr('stroke-width',10)
    .style('cursor','crosshair')
    .on('mouseover', onLinkOver).on('mousemove', onLinkMove).on('mouseout', onLinkOut);
}
