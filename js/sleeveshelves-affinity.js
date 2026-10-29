/* SleeveShelves Shelf Affinity Engine v1.0
 * No API keys, external libraries, network requests, or runtime costs.
 * Browser: window.SleeveShelvesAffinity; Node: require('./sleeveshelves-affinity.js').
 * SECURITY: publicCollections MUST be fetched through a server-side permission-
 * checked endpoint. This client-side visibility check is defense in depth ONLY.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SleeveShelvesAffinity = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function() {
  'use strict';
  const VERSION = '1.0.0';
  const MAX_PUBLIC_COLLECTIONS = 150;
  const MAX_RECORDS_PER_COLLECTION = 250;
  const MAX_MY_RECORDS = 20000;
  const MAX_CANDIDATES = 15000;
  const FEATURE_WEIGHTS = Object.freeze({genre: 0.24, style: 0.37, tag: 0.16, artist: 0.14, era: 0.09});
  const PATH_WEIGHTS = Object.freeze({record: 0.32, journey: 0.27, personal: 0.18, context: 0.14, novelty: 0.09});

  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
  const normalize = str => String(str == null ? '' : str).normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
  const slug = str => normalize(str).replace(/^the /, '');
  const uniq = arr => [...new Set(arr.filter(Boolean))];
  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return [];
      if (v[0] === '[') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch (_) {} }
      return v.split(/[,;|]+/).map(x => x.trim()).filter(Boolean);
    }
    return [];
  }
  const cleanTags = value => uniq(asArray(value).filter(x => typeof x === 'string').map(normalize).filter(Boolean));
  function getYear(record) {
    const yr = Number(record.release_year || record.year || record.raw_data?.year);
    return Number.isInteger(yr) && yr >= 1900 && yr <= 2050 ? yr : null;
  }
  function recordKey(record) {
    // Canonical ALBUM identity, deliberately not pressing/release ID.
    const artist = slug(record.artist), album = slug(record.album || record.title);
    return artist && album ? `${artist}::${album}` : `id:${String(record.id || record.shelf_id || '')}`;
  }
  // Conservative, explainable, zero-API enrichment. These are *inferred*, not
  // factual moods extracted from the audio. Explicit curator tags remain distinct.
  const INFERRED_TAG_RULES = [
    {styles: ['ambient', 'dark ambient', 'drone'], tags: ['atmospheric']},
    {styles: ['downtempo', 'chillout', 'trip hop'], tags: ['downtempo']},
    {styles: ['disco', 'boogie', 'house', 'deep house'], tags: ['dancefloor']},
    {styles: ['progressive rock', 'prog rock', 'art rock'], tags: ['progressive']},
    {styles: ['soul', 'neo soul', 'contemporary r and b'], tags: ['soulful']},
    {styles: ['shoegaze', 'dream pop'], tags: ['dreamy']},
    {styles: ['bebop', 'hard bop', 'post bop'], tags: ['jazz improvisation']},
    {styles: ['synth pop', 'electro', 'electro pop'], tags: ['electronic']},
    {styles: ['minimal', 'minimal techno'], tags: ['minimalist']}
  ];
  function inferTags(genres, styles) {
    const all = new Set([...genres, ...styles]);
    return uniq(INFERRED_TAG_RULES.filter(rule => rule.styles.some(s => all.has(s)))
      .flatMap(rule => rule.tags));
  }
  function features(record) {
    const raw = record.raw_data && typeof record.raw_data === 'object' ? record.raw_data : {};
    const genres = cleanTags([...asArray(record.genres), ...asArray(record.genre), ...asArray(raw.genres)]);
    const styles = cleanTags([...asArray(record.styles), ...asArray(raw.styles)]);
    const explicitTags = cleanTags([...asArray(record.tags), ...asArray(raw.tags)]);
    return {
      genres, styles, tags: uniq([...explicitTags, ...inferTags(genres, styles)]),
      explicitTags,
      artist: slug(record.artist),
      year: getYear(record),
      key: recordKey(record)
    };
  }
  function metadataQuality(f) {
    const signals = [f.artist, f.genres.length, f.styles.length, f.tags.length, f.year];
    return signals.filter(Boolean).length / signals.length;
  }
  function average(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
  function dedupeRecords(records) {
    const byKey = new Map();
    for (const r of records || []) {
      if (!r || typeof r !== 'object') continue;
      const key = recordKey(r);
      if (!byKey.has(key)) byKey.set(key, r);
      else if (metadataQuality(features(r)) > metadataQuality(features(byKey.get(key)))) byKey.set(key, r);
    }
    return [...byKey.values()];
  }
  function buildIdf(myRecords, collections) {
    const corpus = new Map();
    for (const record of myRecords) corpus.set(recordKey(record), record);
    for (const collection of collections) for (const r of collection.records || []) {
      const key = recordKey(r);
      if (!corpus.has(key)) corpus.set(key, r);
    }
    const df = new Map();
    for (const record of corpus.values()) {
      const f = features(record);
      for (const token of uniq([
        ...f.genres.map(x => 'g:'+x), ...f.styles.map(x => 's:'+x),
        ...f.tags.map(x => 't:'+x), f.artist && 'a:'+f.artist
      ])) df.set(token, (df.get(token) || 0) + 1);
    }
    const n = corpus.size;
    const cached = new Map();
    return token => {
      if (!cached.has(token)) cached.set(token,
        clamp(Math.log(1 + (n + 1) / (1 + (df.get(token) || 0))), 0.3, 3.5));
      return cached.get(token);
    };
  }
  function weightedJaccard(a, b, prefix, idf) {
    if (!a.length || !b.length) return 0;
    const sa = new Set(a), sb = new Set(b);
    const all = new Set([...sa, ...sb]);
    let overlap = 0, union = 0;
    for (const token of all) {
      const w = idf(prefix + token);
      if (sa.has(token) && sb.has(token)) overlap += w;
      union += w;
    }
    return union ? overlap / union : 0;
  }
  function musicalSimilarity(x, y, idf) {
    const a = x?.key ? x : features(x), b = y?.key ? y : features(y);
    if (a.key === b.key) return 1;
    const yearDiff = a.year && b.year ? Math.abs(a.year - b.year) : null;
    const genre = weightedJaccard(a.genres, b.genres, 'g:', idf);
    const style = weightedJaccard(a.styles, b.styles, 's:', idf);
    const tag = weightedJaccard(a.tags, b.tags, 't:', idf);
    const artist = a.artist && b.artist && a.artist === b.artist ? 1 : 0;
    const era = yearDiff == null ? 0 : Math.exp(-Math.pow(yearDiff / 9, 2) / 2);
    const evidence = [genre, style, tag, artist].filter(x => x > 0).length;
    // Fixed-weight denominator: missing metadata cannot produce fake "perfect" similarity.
    const value = FEATURE_WEIGHTS.genre * genre + FEATURE_WEIGHTS.style * style +
      FEATURE_WEIGHTS.tag * tag + FEATURE_WEIGHTS.artist * artist + FEATURE_WEIGHTS.era * era;
    // Weak year-only signals should not create confident recommendations.
    return clamp(evidence === 0 ? value * 0.25 : value);
  }
  function makePersonalProfile(myRecords, idf) {
    const terms = new Map();
    const owned = new Set();
    const ownArtists = new Set(), styles = new Set();
    for (const record of dedupeRecords(myRecords)) {
      const f = features(record);
      owned.add(f.key);
      if (f.artist) ownArtists.add(f.artist);
      f.styles.forEach(t => styles.add(t));
      const listens = Math.max(0, Number(record.listen_count) || 0);
      const rating = clamp((Number(record.rating) || 0) / 5);
      const engagement = 1 + (record.liked === true ? 0.28 : 0) + 0.25 * rating + Math.min(0.45, Math.log1p(listens) * 0.12);
      const tokens = [
        ...f.genres.map(t => ['g:'+t, 0.8]), ...f.styles.map(t => ['s:'+t, 1.6]),
        ...f.tags.map(t => ['t:'+t, 1.3]), ...(f.artist ? [['a:'+f.artist, 0.5]] : [])
      ];
      for (const [t, w] of tokens) terms.set(t, (terms.get(t) || 0) + w * engagement);
    }
    // Saturate common terms and use corpus rarity to prevent broad genre monopoly.
    for (const [t, tf] of terms) terms.set(t, Math.sqrt(tf) * idf(t));
    const norm = Math.sqrt([...terms.values()].reduce((a,b)=>a+b*b,0));
    return {terms, norm, owned, ownArtists, styles};
  }
  function personalizedAffinity(record, profile, idf) {
    const f = record?.key ? record : features(record);
    const tokens = [
      ...f.genres.map(t => ['g:'+t, 0.8]), ...f.styles.map(t => ['s:'+t, 1.6]),
      ...f.tags.map(t => ['t:'+t, 1.3]), ...(f.artist ? [['a:'+f.artist, 0.5]] : [])
    ];
    if (!profile.norm || !tokens.length) return 0;
    let dot = 0, n = 0;
    for (const [t, base] of tokens) {
      const w = base * idf(t);
      dot += (profile.terms.get(t) || 0) * w;
      n += w*w;
    }
    return clamp(n ? dot / (profile.norm * Math.sqrt(n)) : 0);
  }
  function novelty(record, profile) {
    const f = features(record);
    if (profile.owned.has(f.key)) return 0;
    const newArtist = f.artist && !profile.ownArtists.has(f.artist) ? 1 : 0;
    const unseenStyle = f.styles.length ? f.styles.filter(s => !profile.styles.has(s)).length / f.styles.length : 0;
    return clamp(0.45 + 0.3 * newArtist + 0.25 * unseenStyle);
  }
  function dna(collection) {
    const records = dedupeRecords(collection.records || []);
    const counter = prop => {
      const tally = new Map();
      for (const record of records) {
        const f = features(record);
        const values = prop === 'artist' ? [f.artist] : f[prop];
        for (const v of uniq(values)) if (v) tally.set(v, (tally.get(v) || 0) + 1);
      }
      return [...tally].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name,count]) => ({name,count,share: records.length ? count / records.length : 0}));
    };
    const decades = new Map();
    for (const rec of records) {
      const yr = getYear(rec); if (!yr) continue;
      const decade = `${Math.floor(yr / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) || 0) + 1);
    }
    return {
      recordCount: records.length, genres: counter('genres'), styles: counter('styles'),
      tags: counter('tags'), artists: counter('artist'),
      decades: [...decades].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count})),
      metadataCoverage: average(records.map(r => metadataQuality(features(r))))
    };
  }
  function pretty(word) { return String(word || '').replace(/\b\w/g, c => c.toUpperCase()); }
  function describeCollection(collection) {
    const d = dna(collection);
    if (!d.recordCount) return 'An empty shelf, ready for its first record.';
    const styles = d.styles.slice(0, 2).map(x => pretty(x.name));
    const genres = d.genres.slice(0, 2).map(x => pretty(x.name));
    const descriptor = styles.length ? styles : genres;
    const era = d.decades.length && d.decades[0].count >= Math.max(2, Math.ceil(d.recordCount * 0.25)) ? d.decades[0].name : null;
    const artists = d.artists.filter(x => x.name && x.name !== 'various artists').slice(0, 2).map(x => pretty(x.name));
    let text = descriptor.length ? `A shelf exploring ${descriptor.join(' and ')}.` : 'An eclectic selection of vinyl records.';
    if (era) text += ` The ${era} are particularly well represented.`;
    if (artists.length && (d.artists[0].count >= 2 || d.recordCount <= 4)) text += ` Featuring recordings by ${artists.join(' and ')}.`;
    return text;
  }
  function getRelatedInCollection(anchorF, entryF, records, owned, idf, limit = 5, fOf = features) {
    const neighbors = [];
    for (const record of records) {
      const f = fOf(record);
      if (f.key === anchorF.key || f.key === entryF.key || owned.has(f.key)) continue;
      const aSim = musicalSimilarity(anchorF, f, idf);
      const eSim = musicalSimilarity(entryF, f, idf);
      const score = 0.5 * aSim + 0.5 * eSim;
      if (score >= 0.095) neighbors.push({record, score});
    }
    return neighbors.sort((a,b) => b.score - a.score || recordKey(a.record).localeCompare(recordKey(b.record))).slice(0, limit);
  }
  function formatReason(anchorF, entry, collection, neighbors, parts) {
    const f = features(entry);
    const commonStyles = f.styles.filter(x => anchorF.styles.includes(x));
    const commonGenres = f.genres.filter(x => anchorF.genres.includes(x));
    const reason = commonStyles.length ? `Shared ${pretty(commonStyles[0])} style` :
      commonGenres.length ? `Shared ${pretty(commonGenres[0])} roots` :
      f.artist === anchorF.artist ? 'More from the same artist' :
      parts.personal >= 0.18 ? 'Matches the music on your shelf' : 'A related musical direction';
    return `${reason}${neighbors.length ? `, with ${neighbors.length} more records to explore in this collection` : ''}.`;
  }
  // The same musical evidence drives local rediscovery, without the social
  // journey bonus because all results already belong to the current owner.
  function recommendMyShelf({anchorRecord, myRecords = [], limit = 8} = {}) {
    if (!anchorRecord || typeof anchorRecord !== 'object') throw new TypeError('anchorRecord is required');
    const my = dedupeRecords(myRecords).slice(0, MAX_MY_RECORDS);
    const idf = buildIdf(my, []);
    const anchorF = features(anchorRecord);
    const scored = [];
    for (const record of my) {
      const f = features(record);
      if (f.key === anchorF.key) continue;
      const affinity = musicalSimilarity(anchorF, f, idf);
      if (affinity >= 0.10) scored.push({record, score: Number(affinity.toFixed(5)), reason: 'Related music already on your shelf'});
    }
    scored.sort((a,b) => b.score-a.score || recordKey(a.record).localeCompare(recordKey(b.record)));
    const results = [];
    for (const item of scored) {
      if (results.length >= Math.max(1,Math.min(20,Number(limit)||8))) break;
      const duplicateArtist = results.filter(r => features(r.record).artist === features(item.record).artist).length;
      if (duplicateArtist < 2) results.push(item);
    }
    return {version: VERSION, recommendations: results, metadataOnly: true};
  }
  // A tiny adapter for rows returned by the security-reviewed Supabase RPC.
  // Never derive public access from client-provided booleans outside this adapter.
  function fromDiscoveryRows(rows) {
    const groups = new Map();
    for (const row of rows || []) {
      const id = String(row.collection_id || '');
      if (!id || !row.record_id) continue;
      if (!groups.has(id)) groups.set(id, {
        id, name: row.collection_name || 'Untitled Collection',
        ownerId: row.owner_id, visibility: 'public', roomOpen: true, records: []
      });
      groups.get(id).records.push({id: row.record_id, artist: row.artist,
        album: row.album, genre: row.genre, genres: row.genres, styles: row.styles,
        year: row.release_year, cover_url: row.cover_url});
    }
    return [...groups.values()];
  }
  function recommend({anchorRecord, myRecords = [], publicCollections = [], subscribedCollectionIds = [], limit = 8, includeOwned = false, includeSubscribed = false, userId = null, focusAlbum = null} = {}) {
    if (!anchorRecord || typeof anchorRecord !== 'object') throw new TypeError('anchorRecord is required');
    const my = dedupeRecords(myRecords).slice(0, MAX_MY_RECORDS);
    const subscribed = new Set(subscribedCollectionIds.map(String));
    // Defense in depth. The server must *also* enforce these properties.
    const publicOnly = publicCollections.filter(c => c && c.visibility === 'public' && c.roomOpen === true &&
      c.id != null && (!userId || String(c.ownerId) !== String(userId)) &&
      (includeSubscribed || !subscribed.has(String(c.id)))).slice(0, MAX_PUBLIC_COLLECTIONS);
    const allowed = publicOnly.map(c => ({...c, records: dedupeRecords(c.records || []).slice(0, MAX_RECORDS_PER_COLLECTION)}));
    const idf = buildIdf(my, allowed);
    const profile = makePersonalProfile(my, idf);
    const featureCache = new WeakMap();
    const fOf = rec => {
      if (!featureCache.has(rec)) featureCache.set(rec, features(rec));
      return featureCache.get(rec);
    };
    const anchorF = fOf(anchorRecord);
    const candidatePaths = [];
    let count = 0;
    const personalCache = new Map();
    for (const collection of allowed) {
      if (!collection.records.length) continue;
      const records = collection.records;
      // A large unsegmented collection can still contain a highly relevant micro-shelf.
      for (const entry of records) {
        if (++count > MAX_CANDIDATES) break;
        const f = fOf(entry);
        if (f.key === anchorF.key || (!includeOwned && profile.owned.has(f.key))) continue;
        const recScore = musicalSimilarity(anchorF, f, idf);
        if (recScore < 0.10) continue;
        const neighbors = getRelatedInCollection(anchorF, f, records, profile.owned, idf, 5, fOf);
        const journey = clamp(0.62 * average(neighbors.map(n => n.score)) + 0.38 * Math.min(1, neighbors.length / 5));
        const personal = personalCache.has(f.key) ? personalCache.get(f.key) : personalizedAffinity(f, profile, idf);
        personalCache.set(f.key, personal);
        const context = clamp(0.7 * average(neighbors.slice(0, 3).map(n => musicalSimilarity(f, fOf(n.record), idf))) +
          0.3 * metadataQuality(f));
        const novel = novelty(f, profile);
        const weakEvidence = recScore < 0.2 && neighbors.length < 2;
        const relevance = PATH_WEIGHTS.record * recScore + PATH_WEIGHTS.journey * journey +
          PATH_WEIGHTS.personal * personal + PATH_WEIGHTS.context * context + PATH_WEIGHTS.novelty * novel;
        const score = clamp(relevance * (weakEvidence ? 0.7 : 1) * (neighbors.length === 0 ? 0.78 : 1));
        candidatePaths.push({
          record: entry, collectionId: String(collection.id), collectionName: String(collection.name || 'Untitled Collection'),
          ownerId: String(collection.ownerId || ''), score: Number(score.toFixed(5)),
          breakdown: {record: recScore, journey, personal, context, novelty: novel},
          nextRecords: neighbors.map(n => ({record: n.record, relevance: Number(n.score.toFixed(4))})),
          reason: formatReason(anchorF, entry, collection, neighbors, {personal})
        });
      }
      if (count > MAX_CANDIDATES) break;
    }
    candidatePaths.sort((a,b) => b.score - a.score || a.collectionId.localeCompare(b.collectionId) || recordKey(a.record).localeCompare(recordKey(b.record)));
    // FIRST decide which owner's collection is the best home for each album.
    // If diversification runs first, a weaker alternate owner can steal an album
    // after the better collection reaches its display cap.
    const bestOriginByAlbum = new Map();
    for (const path of candidatePaths) {
      const key = recordKey(path.record);
      if (!bestOriginByAlbum.has(key)) bestOriginByAlbum.set(key, path);
    }
    const bestPaths = [...bestOriginByAlbum.values()].filter(path =>
      focusAlbum == null || recordKey(path.record) === (typeof focusAlbum === 'string' ? focusAlbum : recordKey(focusAlbum)));

    // Maximal marginal relevance (MMR): several musical entry points, not a wall of one artist or one collector.
    const results = [], usedKeys = new Set(), ownerCounts = new Map(), collectionCounts = new Map();
    const cap = Math.max(1, Math.min(20, Number(limit) || 8));
    while (results.length < cap) {
      let best = null, bestRank = -Infinity;
      for (const item of bestPaths) {
        const key = recordKey(item.record);
        if (usedKeys.has(key) || (ownerCounts.get(item.ownerId) || 0) >= 2 ||
           (collectionCounts.get(item.collectionId) || 0) >= 2) continue;
        const redundancy = results.length ? Math.max(...results.map(r => {
          const similar = musicalSimilarity(fOf(r.record), fOf(item.record), idf);
          const sameOwner = r.ownerId === item.ownerId ? 0.15 : 0;
          return Math.max(similar, sameOwner);
        })) : 0;
        const mmr = 0.87 * item.score - 0.13 * redundancy;
        if (mmr > bestRank) { best = item; bestRank = mmr; }
      }
      if (!best) break;
      results.push(best);
      usedKeys.add(recordKey(best.record));
      ownerCounts.set(best.ownerId, (ownerCounts.get(best.ownerId) || 0) + 1);
      collectionCounts.set(best.collectionId, (collectionCounts.get(best.collectionId) || 0) + 1);
    }
    return {version: VERSION, recommendations: results, evaluatedPaths: candidatePaths.length,
      evaluatedCollections: allowed.length, metadataOnly: true};
  }
  return Object.freeze({VERSION, FEATURE_WEIGHTS, PATH_WEIGHTS, recordKey, features, dna, describeCollection, fromDiscoveryRows, recommend, recommendMyShelf});
});
