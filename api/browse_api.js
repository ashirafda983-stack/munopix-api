const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gbbyvbylbnskksxpwnth.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiYnl2YnlsYm5za2tzeHB3bnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjEyODYwNywiZXhwIjoyMTA3NzA0NjA3fQ.JNNqf77NMCR0F3L1pavcQhyWZ96IM-JRlz2WGL32FqQ';

// Initialize Supabase with explicit header options to prevent URL-parsing issues with keys
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  global: {
    headers: { 'apikey': SUPABASE_KEY }
  }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, type, genre, vj, tag, page = 1, perPage = 20, filters } = req.query;

  try {
    if (filters === '1') {
      const { data: mediaItems, error } = await supabase
        .from('media_library')
        .select('genres, vjs');

      if (error) throw error;

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

    let query = supabase
      .from('media_library')
      .select('*, episodes(*)', { count: 'exact' });

    if (q && q.trim() !== '') {
      query = query.or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
    }
    if (type && type.trim() !== '') {
      query = query.eq('content_type', type.trim());
    }
    if (genre && genre.trim() !== '') {
      query = query.contains('genres', [genre.trim()]);
    }
    if (vj && vj.trim() !== '') {
      query = query.contains('vjs', [vj.trim()]);
    }

    query = query
      .range(offset, offset + pp - 1)
      .order('created_at', { ascending: false });

    const { data, count, error } = await query;
    if (error) throw error;

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
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pp),
      items
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

