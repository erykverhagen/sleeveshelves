/* SleeveShelves Supabase discovery adapter, browser-friendly.
 * Requires a previously loaded js/sleeveshelves-affinity.js and the OPTIONAL
 * privacy-gated SQL RPC in staging. Makes NO writes and no paid AI calls.
 */
(function(root) {
 'use strict';
 async function discover({supabase, anchorRecord, myRecords, userId, subscribedCollectionIds = [], limit = 8}) {
   if (!supabase || typeof supabase.rpc !== 'function') throw new TypeError('An initialized Supabase client is required');
   if (!root.SleeveShelvesAffinity) throw new Error('Load sleeveshelves-affinity.js first');
   if (!anchorRecord?.id) throw new TypeError('A saved record ID is required for database discovery');
   if (!Array.isArray(myRecords)) throw new TypeError('Pass the complete authenticated My Shelf records array');
   const {data, error} = await supabase.rpc('ss_discovery_candidates', {
     p_anchor_id: anchorRecord.id,
     p_max_collections: 30,
     p_max_records_per_collection: 50
   });
   if (error) throw error;
   return root.SleeveShelvesAffinity.recommend({
     anchorRecord, myRecords,
     publicCollections: root.SleeveShelvesAffinity.fromDiscoveryRows(data || []),
     subscribedCollectionIds, userId, limit
   });
 }
 root.SleeveShelvesDiscoveryAdapter = Object.freeze({discover});
})(typeof window === 'undefined' ? globalThis : window);
