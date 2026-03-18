// ═══════════════════════════════════════════════════════════
// OPENROUTER API CLIENT
// ═══════════════════════════════════════════════════════════
import { OPENROUTER_KEY, DEFAULT_MODEL } from '../config.js';

export let currentModel = DEFAULT_MODEL;
export function setModel(m) { currentModel = m || DEFAULT_MODEL; }

export async function callOpenRouter(prompt, maxTokens = 400) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hirst.research.kg',
      'X-Title': 'Hirst Research Knowledge Graph',
    },
    body: JSON.stringify({
      model: currentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.15,
      max_tokens: maxTokens,
    })
  });
  if (r.status === 402) throw new Error('402: Model requires credits. Select a :free model.');
  if (r.status === 404) throw new Error(`404: Model not found — "${currentModel}"`);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(r.status + ': ' + (t.slice(0, 120) || 'OpenRouter error'));
  }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const m = content.replace(/```json?\n?/g,'').replace(/```/g,'').trim().match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON object in response. Got: ' + content.slice(0, 80));
  try { return JSON.parse(m[0]); }
  catch (pe) { throw new Error('JSON parse failed: ' + pe.message); }
}

export async function callOpenRouterChat(systemPrompt, messages, maxTokens = 900) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hirst.research.kg',
      'X-Title': 'Hirst Research KG Chat',
    },
    body: JSON.stringify({
      model: currentModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.35,
      max_tokens: maxTokens,
    })
  });
  if (r.status === 402) throw new Error('402: Model "'+currentModel+'" requires credits. Switch to a :free model.');
  if (r.status === 404) throw new Error('404: Model "'+currentModel+'" not found.');
  if (!r.ok) { const t = await r.text().catch(()=>''); throw new Error(r.status+': '+(t.slice(0,120)||'OpenRouter error')); }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const stripped = content.replace(/```json?\n?/g,'').replace(/```/g,'').trim();
  const m = stripped.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON object in response. Got: ' + content.slice(0, 80));
  try { return JSON.parse(m[0]); }
  catch (pe) { throw new Error('JSON parse failed: ' + pe.message); }
}

/**
 * Fetch the list of free models available on OpenRouter.
 * Filters to models where the ID ends in ":free" or where both prompt
 * and completion pricing are "0" (genuinely zero-cost models).
 * @returns {Promise<Array<{id: string, name: string, context: number}>>}
 */
export async function fetchFreeModels() {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const models = (data.data || [])
      .filter(m =>
        m.id.endsWith(':free') ||
        (m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      )
      .map(m => ({
        id:      m.id,
        name:    m.name || m.id,
        context: m.context_length ?? 0,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return models;
  } catch (e) {
    console.warn('[client] fetchFreeModels failed:', e.message);
    return [];
  }
}
