const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gbbyvbylbnskksxpwnth.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiYnl2YnlsYm5za2tzeHB3bnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjEyODYwNywiZXhwIjoyMTA3NzA0NjA3fQ.JNNqf77NMCR0F3L1pavcQhyWZ96IM-JRlz2WGL32FqQ';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, type, genre, vj, tag, page = 1, perPage = 20, filters } = req.query;

  try {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    if (filters === '1') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/media_library?select=genres,vjs`, { headers });
      const mediaItems = await response.json();

      if (!Array.isArray(mediaItems)) {
        throw new Error(JSON.stringify(mediaItems));
      }

      const genresSet = new Set();
      const vjsSet = new Set();
      mediaItems.forEach(item => {
        (item.genres || []).forEach(g => genresSet.add(g));
        (item.vjs || []).forEach(v => vjsSet.add(v));
      });

      return res.status(200).json({
        success: true,
        filters: {
          genres: Array.from(genresSet).sort(),
          vjs: Array.from(vjsSet).sort(),
          tags: []
        }
      });
    }

    const p = parseInt(page) || 1;
    const pp = parseInt(perPage) || 20;
    const offset = (p - 1) * pp;
    const limit = pp;

    // Build PostgREST query URL with embedded episodes
    let targetUrl = `${SUPABASE_URL}/rest/v1/media_library?select=*,episodes(*)&order=created_at.desc&offset=${offset}&limit=${limit}`;

    if (q && q.trim() !== '') {
      const queryStr = q.trim();
      targetUrl += `&or=(title.ilike.*${queryStr}*,description.ilike.*${queryStr}*)`;
    }
    if (type && type.trim() !== '') {
      targetUrl += `&content_type=eq.${type.trim()}`;
    }
    if (genre && genre.trim() !== '') {
      targetUrl += `&genres=cs.{${genre.trim()}}`;
    }
    if (vj && vj.trim() !== '') {
      targetUrl += `&vjs=cs.{${vj.trim()}}`;
    }

    const response = await fetch(targetUrl, {
      headers: { ...headers, 'Range-Unit': 'items', 'Prefer': 'count=exact' }
    });

    const contentRange = response.headers.get('content-range');
    let totalCount = 0;
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts.length === 2) totalCount = parseInt(parts[1], 10) || 0;
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(JSON.stringify(data));
    }

    const items = data.map(item => ({
      id: item.id,
      title: item.title,
      contentType: item.content_type,
      year: item.year,
      description: item.description,
      poster: item.poster,
      backdrop: item.backdrop,
      genres: item.genres || [],
      vjs: item.vjs || [],
      stream_link: item.stream_link,
      episodes: item.episodes ? item.episodes.map(ep => ({
        season: ep.season,
        episode: ep.episode,
        link: ep.link
      })) : []
    }));

    return res.status(200).json({
      success: true,
      page: p,
      perPage: pp,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pp) || 1,
      items
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
