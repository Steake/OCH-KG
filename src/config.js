// ═══════════════════════════════════════════════════════════
// COLOURS & STYLES
// ═══════════════════════════════════════════════════════════

export const CC = {
  consciousness: { fill:"#b07dff", stroke:"#c8a0ff" },
  trust:         { fill:"#5ecfa0", stroke:"#7ae4b8" },
  crypto:        { fill:"#f0a040", stroke:"#f8c070" },
  collective:    { fill:"#60c8f0", stroke:"#80d8ff" },
};

export const OLI_C = { fill:"#6e9fff", stroke:"#9abfff" };

export const LINK_STYLE = {
  cites:        { color:"#3a4a80", w:1.4, dash:"" },
  extends:      { color:"#6050c0", w:2.2, dash:"5,3" },
  inherits:     { color:"#7060d8", w:2.5, dash:"5,3" },
  uses:         { color:"#3a6050", w:1.6, dash:"3,3" },
  seeds:        { color:"#6050c0", w:2,   dash:"5,3" },
  supports:     { color:"#3a5060", w:1.5, dash:"3,3" },
  publishes_to: { color:"#3a4898", w:2,   dash:"5,3" },
  integrates:   { color:"#605838", w:1.5, dash:"3,3" },
  builds_on:    { color:"#5a4a32", w:1.3, dash:"4,3" },
  similar:      { color:"#2a4838", w:1,   dash:"2,4" },
};

export const EDGE_EPISTEMIC = {
  cites:        "Direct bibliographic citation — appears in paper references",
  extends:      "Formal extension — adds definitions, theorems, or models to this work",
  inherits:     "Structural inheritance — derives axioms or architecture from",
  uses:         "Applied dependency — employs this framework as a substrate",
  seeds:        "Conceptual seeding — bootstraps priors or structures from",
  supports:     "Corroborating mechanism — validates or complements this approach",
  publishes_to: "Publication pathway — outputs flow into this platform or registry",
  integrates:   "Full integration — embeds this system as a sub-component",
  builds_on:    "Theoretical foundation — uses core ideas as base layer",
  similar:      "Thematic adjacency — parallel research in the same conceptual space",
};

// Edge weights for EQBSL trust propagation and PageRank
export const EW = {
  extends:0.85, inherits:0.80, builds_on:0.65, cites:0.70,
  seeds:0.65,   uses:0.55,     supports:0.50,  integrates:0.50,
  publishes_to:0.45, similar:0.30
};

// PageRank edge weights
export const PR_W = {
  extends:0.85, inherits:0.80, builds_on:0.65, cites:0.70,
  seeds:0.65,   uses:0.55,     supports:0.50,  integrates:0.50,
  publishes_to:0.45, similar:0.30
};

export const CLUSTER_BADGE = {
  consciousness: 'cons', trust: 'trust', crypto: 'crypto', collective: 'coll'
};

export const EDGE_COLOR = {
  cites:'#4a6aaa', extends:'#8060d0', inherits:'#7060d8', uses:'#406858',
  seeds:'#7060c0', supports:'#405868', publishes_to:'#404890',
  integrates:'#706840', builds_on:'#806040', similar:'#2a5040',
};

export const OPENROUTER_KEY = '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';
export const DEFAULT_MODEL   = 'openrouter/hunter-alpha';
