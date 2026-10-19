const SUPABASE_URL = process.env.SUPABASE_URL || "https://gbbyvbylbnskksxpwnth.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, type, genre, vj, tag, page = 1, perPage = 20, filters, all } = req.query;

  try {
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    };

    if (filters === '1') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/media_library?select=genres,vjs`, { headers });
      const mediaItems = await response.json();

      const genresSet = new Set();
      const vjsSet = new Set();
      if (Array.isArray(mediaItems)) {
        mediaItems.forEach(item => {
          (item.genres || []).forEach(g => genresSet.add(g));
          (item.vjs || []).forEach(v => vjsSet.add(v));
        });
      }

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
    const startRange = (all === 'true') ? 0 : (p - 1) * pp;
    const endRange = (all === 'true') ? 1999 : (startRange + pp - 1);

    const queryParams = new URLSearchParams();
    queryParams.set("select", "*,episodes(*)");
    queryParams.set("order", "created_at.desc");

    if (q && q.trim() !== '') {
      queryParams.set("or", `(title.ilike.*${q.trim()}*,description.ilike.*${q.trim()}*)`);
    }
    if (type && type.trim() !== '') {
      queryParams.set("content_type", `eq.${type.trim()}`);
    }
    if (genre && genre.trim() !== '') {
      queryParams.set("genres", `cs.{${genre.trim()}}`);
    }
    if (vj && vj.trim() !== '') {
      queryParams.set("vjs", `cs.{${vj.trim()}}`);
    }

    const reqHeaders = {
      ...headers,
      "Prefer": "count=exact",
      "Range": `${startRange}-${endRange}`
    };

    const fetchUrl = `${SUPABASE_URL}/rest/v1/media_library?${queryParams.toString()}`;
    const response = await fetch(fetchUrl, { headers: reqHeaders });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase Error: ${errText}`);
    }

    const data = await response.json();
    const contentRange = response.headers.get("content-range");
    let totalCount = 0;
    if (contentRange && contentRange.includes("/")) {
      totalCount = parseInt(contentRange.split("/")[1]) || data.length;
    } else {
      totalCount = data.length;
    }

    const items = (Array.isArray(data) ? data : []).map(item => ({
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
      page: all === 'true' ? 1 : p,
      perPage: all === 'true' ? items.length : pp,
      total: totalCount,
      totalPages: all === 'true' ? 1 : Math.ceil(totalCount / pp),
      items
    });

  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
