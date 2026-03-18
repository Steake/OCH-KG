// ═══════════════════════════════════════════════════════════
// SESSION STORE — localStorage persistence for
// AI-generated edges, dynamically added nodes, and
// inferred chat edges (gold dashed lines).
// ═══════════════════════════════════════════════════════════

const KEY = 'kg_session_v1';

/** Extract a stable string ID from a D3 node reference (object or plain string). */
function eid(ref) {
  if (ref !== null && typeof ref === 'object') return ref.id ?? String(ref);
  return String(ref ?? '');
}

/**
 * Persist session delta to localStorage.
 *
 * @param {object[]} nodes           - full live nodes array (filters to dyn_ prefix)
 * @param {object[]} linkData        - full live linkData array
 * @param {number}   staticEdgeCount - linkData.length before any session restore
 * @param {object[]} tempLinks       - chat-inferred temp edges (gold dashed)
 */
export function saveSession(nodes, linkData, staticEdgeCount, tempLinks = []) {
  // Only persist nodes added dynamically at runtime
  const dynNodes = nodes
    .filter(n => typeof n.id === 'string' && n.id.startsWith('dyn_'))
    .map(n => {
      // Strip D3 simulation internals (vx, vy, fx, fy, index) — keep only data
      const { vx, vy, fx, fy, index, ...rest } = n;
      return { ...rest, x: n.x ?? 0, y: n.y ?? 0 };
    });

  // Only persist edges added after the initial static LINKS set
  const sessionEdges = linkData.slice(staticEdgeCount).map(l => ({
    s:      eid(l.source),
    t:      eid(l.target),
    type:   l.type   || 'similar',
    reason: l.reason || '',
  }));

  // Inferred edges are string-ID tuples pushed by executeActions → tempLinks
  const inferredEdges = tempLinks.map(l => ({
    s:      eid(l.source),
    t:      eid(l.target),
    reason: l.reason || '',
  }));

  try {
    localStorage.setItem(KEY, JSON.stringify({
      dynNodes,
      sessionEdges,
      inferredEdges,
      savedAt:   Date.now(),
      edgeCount: sessionEdges.length,
      nodeCount: dynNodes.length,
    }));
  } catch (e) {
    console.warn('[session] Save failed (quota?):', e.message);
  }
}

/**
 * Load persisted session from localStorage.
 * @returns {{ dynNodes: object[], sessionEdges: object[], inferredEdges: object[], savedAt: number }}
 */
export function loadSession() {
  const empty = { dynNodes: [], sessionEdges: [], inferredEdges: [], savedAt: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const d = JSON.parse(raw);
    return {
      dynNodes:      Array.isArray(d.dynNodes)      ? d.dynNodes      : [],
      sessionEdges:  Array.isArray(d.sessionEdges)  ? d.sessionEdges  : [],
      inferredEdges: Array.isArray(d.inferredEdges) ? d.inferredEdges : [],
      savedAt:       d.savedAt ?? 0,
    };
  } catch (e) {
    console.warn('[session] Load failed:', e.message);
    return empty;
  }
}

/** Remove all session data from localStorage. */
export function clearSession() {
  localStorage.removeItem(KEY);
}

/** Human-readable summary of what is currently stored. */
export function sessionSummary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 'No session data stored.';
    const d   = JSON.parse(raw);
    const age = d.savedAt
      ? Math.round((Date.now() - d.savedAt) / 60000) + 'm ago'
      : 'unknown time';
    return (
      `Session: ${d.edgeCount ?? 0} AI edges · ` +
      `${d.nodeCount ?? 0} added papers · ` +
      `${d.inferredEdges?.length ?? 0} inferred — saved ${age}`
    );
  } catch {
    return 'Session data unreadable.';
  }
}
