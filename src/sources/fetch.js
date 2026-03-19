// ═══════════════════════════════════════════════════════════
// EXTERNAL METADATA FETCHERS
// arXiv · Zenodo · Crossref (DOI)
// ═══════════════════════════════════════════════════════════

export async function fetchArxivMeta(arxivId) {
  const id = arxivId
    .replace(/^.*arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/^arxiv:/i, '')
    .replace(/v\d+$/, '')
    .trim();
  try {
    const r = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent('https://export.arxiv.org/api/query?id_list='+id)}`
    );
    const txt = await r.text();
    const xml = new DOMParser().parseFromString(txt, 'text/xml');
    const entry = xml.querySelector('entry');
    if (!entry) return null;
    const title     = entry.querySelector('title')?.textContent?.trim() || 'Unknown';
    const abstract  = entry.querySelector('summary')?.textContent?.trim() || '';
    const authors   = Array.from(entry.querySelectorAll('author name')).map(a => a.textContent.trim()).slice(0,4);
    const published = entry.querySelector('published')?.textContent || '';
    const year      = published ? parseInt(published.slice(0,4)) : 2024;
    const url       = `https://arxiv.org/abs/${id}`;
    return { title, abstract, authors, year, url, doi:null, src:'arXiv', arxivId: id };
  } catch(e) {
    return null;
  }
}

/** Search arXiv by keyword and return lightweight paper metadata candidates. */
export async function searchArxivByKeyword(query, limit = 8) {
  if (!query) return [];
  try {
    const q = encodeURIComponent(`all:${query}`);
    const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=${Math.max(1, Math.min(limit, 20))}&sortBy=relevance&sortOrder=descending`;
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!r.ok) return [];
    const txt = await r.text();
    const xml = new DOMParser().parseFromString(txt, 'text/xml');
    const entries = Array.from(xml.querySelectorAll('entry'));
    return entries.map(entry => {
      const idRaw = entry.querySelector('id')?.textContent?.trim() || '';
      const arxivId = idRaw.split('/abs/')[1]?.replace(/v\d+$/, '') || null;
      const title = entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || 'Unknown';
      const abstract = entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const authors = Array.from(entry.querySelectorAll('author name')).map(a => a.textContent.trim()).slice(0, 4);
      const published = entry.querySelector('published')?.textContent || '';
      const year = published ? parseInt(published.slice(0, 4), 10) : 2024;
      return {
        title,
        abstract: abstract.slice(0, 500),
        authors,
        year,
        url: arxivId ? `https://arxiv.org/abs/${arxivId}` : (idRaw || ''),
        doi: null,
        src: 'arXiv',
        arxivId,
        tags: [query],
      };
    }).filter(p => p.title && p.url);
  } catch {
    return [];
  }
}

export async function fetchZenodoMeta(zenodoId) {
  try {
    const r = await fetch(`https://zenodo.org/api/records/${zenodoId}`);
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data.metadata || {};
    const title    = meta.title || 'Unknown';
    const abstract = (meta.description || '').replace(/<[^>]*>/g, '').slice(0, 400);
    const authors  = (meta.creators||[]).map(c=>c.name||c.person_or_org?.name||'Unknown').slice(0,4);
    const year     = parseInt((meta.publication_date||'2024').slice(0,4));
    const doi      = data.doi || '';
    const url      = `https://zenodo.org/record/${zenodoId}`;
    return { title, abstract, authors, year, url, doi, src:'Zenodo', zenodoId };
  } catch(e) {
    return null;
  }
}

/** Search Zenodo by keyword and return lightweight paper metadata candidates. */
export async function searchZenodoByKeyword(query, limit = 8) {
  if (!query) return [];
  try {
    const size = Math.max(1, Math.min(limit, 25));
    const r = await fetch(
      `https://zenodo.org/api/records/?q=${encodeURIComponent(query)}&size=${size}&sort=bestmatch`
    );
    if (!r.ok) return [];
    const data = await r.json();
    const hits = data.hits?.hits || [];
    return hits.map(hit => {
      const meta = hit.metadata || {};
      const title = meta.title || 'Unknown';
      const abstract = (meta.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const authors = (meta.creators || []).map(c => c.name || c.person_or_org?.name || 'Unknown').slice(0, 4);
      const year = parseInt((meta.publication_date || '2024').slice(0, 4), 10) || 2024;
      const doi = hit.doi || '';
      const recid = hit.id || hit.recid;
      return {
        title,
        abstract: abstract.slice(0, 500),
        authors,
        year,
        url: recid ? `https://zenodo.org/record/${recid}` : '',
        doi,
        src: 'Zenodo',
        zenodoId: recid,
        tags: [query],
      };
    }).filter(p => p.title && p.url);
  } catch {
    return [];
  }
}

export async function fetchDoiMeta(doi) {
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!r.ok) return null;
    const data = await r.json();
    const item     = data.message || {};
    const title    = (item.title||[])[0] || 'Unknown';
    const abstract = (item.abstract||'').replace(/<[^>]*>/g,'').slice(0,400);
    const authors  = (item.author||[]).map(a=>`${a.family||''}, ${a.given||''}`.trim()).slice(0,4);
    const year     = (item.published?.['date-parts']?.[0]?.[0]) || 2024;
    const url      = item.URL || `https://doi.org/${doi}`;
    return { title, abstract, authors, year, url, doi, src:'external', isDoi:true };
  } catch(e) {
    return null;
  }
}

/** Parse a raw input string and dispatch to the correct fetcher. */
export async function fetchMetaFromInput(raw) {
  if (!raw) return { meta:null, error:'Empty input' };

  if (/arxiv\.org/.test(raw) || /^arxiv:/i.test(raw) || /^\d{4}\.\d{4,5}/.test(raw)) {
    const meta = await fetchArxivMeta(raw);
    return meta ? { meta } : { meta:null, error:`Could not fetch arXiv metadata for "${raw}"` };
  }

  if (/zenodo\.org\/record[s]?\/(\d+)/.test(raw)) {
    const zid  = raw.match(/zenodo\.org\/record[s]?\/(\d+)/)[1];
    const meta = await fetchZenodoMeta(zid);
    return meta ? { meta } : { meta:null, error:`Could not fetch Zenodo record ${zid}` };
  }

  if (/^10\.\d{4,}\//.test(raw)) {
    if (/zenodo/.test(raw)) {
      const zid  = raw.split('.').pop();
      const meta = await fetchZenodoMeta(zid);
      return meta ? { meta } : { meta:null, error:`Could not fetch Zenodo ${zid}` };
    }
    const meta = await fetchDoiMeta(raw);
    return meta ? { meta } : { meta:null, error:`Could not fetch DOI metadata for "${raw}"` };
  }

  return { meta:null, error:'Could not parse input. Try: 10.5281/zenodo.ID, arxiv:XXXX.XXXXX, or a full URL.' };
}
