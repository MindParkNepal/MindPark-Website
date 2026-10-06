'use strict';

const WP_ORIGIN = 'https://mindparkapp.whf.bz';
const PAGE_SIZE = 9;
// Match WordPress category slugs, including the site's existing development category.
const TOPICS = [
  { slug: 'autism-development', name: 'Autism & Development', categories: ['autism-development', 'autism', 'development', 'child-cognitive-development'] },
  { slug: 'adhd-attention', name: 'ADHD & Attention', categories: ['adhd-attention', 'adhd', 'attention'] },
  { slug: 'sleep', name: 'Sleep', categories: ['sleep'] },
  { slug: 'anxiety', name: 'Anxiety', categories: ['anxiety'] },
  { slug: 'friendships', name: 'Friendships', categories: ['friendships', 'friendship'] },
  { slug: 'daily-routines', name: 'Daily Routines', categories: ['daily-routines', 'routines'] }
];
class BlogError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
async function request(path, params, fetcher) {
  const url = new URL(`/wp-json/wp/v2/${path}`, WP_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    if (response.status === 400) {
      const error = await response.json().catch(() => ({}));
      if (error.code === 'rest_post_invalid_page_number') throw new BlogError('Page not found', 404);
    }
    throw new BlogError('WordPress is temporarily unavailable');
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new BlogError('Unexpected WordPress response');
  return { data, pages: Math.max(1, Number(response.headers.get('x-wp-totalpages')) || 1), total: Number(response.headers.get('x-wp-total')) || 0 };
}
function topicCategoryIds(topic, categories) {
  const ids = new Set(categories.filter(c => topic.categories.includes(c.slug)).map(c => c.id));
  let count;
  do {
    count = ids.size;
    categories.forEach(c => { if (ids.has(c.parent)) ids.add(c.id); });
  } while (ids.size !== count);
  return [...ids];
}
async function allCategories(fetcher) {
  const first = await request('categories', { per_page: 100, page: 1, hide_empty: false }, fetcher);
  const result = [...first.data];
  for (let page = 2; page <= first.pages; page++) result.push(...(await request('categories', { per_page: 100, page, hide_empty: false }, fetcher)).data);
  return result;
}
async function loadBlog({ slug, topic: topicSlug, page = 1 }, fetcher = fetch) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new BlogError('Page not found', 404);
  if (slug) {
    if (slug.length > 200 || /[/?#\\\u0000-\u001f]/.test(slug)) throw new BlogError('Article not found', 404);
    const result = await request('posts', { slug, status: 'publish', _embed: 'wp:featuredmedia,wp:term', per_page: 1 }, fetcher);
    const post = result.data[0];
    if (!post || post.status !== 'publish' || post.content?.protected || post.excerpt?.protected) throw new BlogError('Article not found', 404);
    return { kind: 'article', post };
  }
  const topic = TOPICS.find(t => t.slug === topicSlug);
  if (topicSlug && !topic) throw new BlogError('Topic not found', 404);
  const params = { status: 'publish', per_page: PAGE_SIZE, page, orderby: 'date', order: 'desc', _embed: 'wp:featuredmedia,wp:term' };
  if (topic) {
    const ids = topicCategoryIds(topic, await allCategories(fetcher));
    if (!ids.length) {
      if (page !== 1) throw new BlogError('Page not found', 404);
      return { kind: 'listing', topic, posts: [], page: 1, pages: 1, total: 0 };
    }
    params.categories = ids.join(',');
  }
  const result = await request('posts', params, fetcher);
  return { kind: 'listing', topic, posts: result.data.filter(p => p.status === 'publish' && !p.content?.protected && !p.excerpt?.protected), page, pages: result.pages, total: result.total };
}
module.exports = { WP_ORIGIN, TOPICS, BlogError, loadBlog, topicCategoryIds };
