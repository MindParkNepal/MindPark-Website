'use strict';
const { loadBlog } = require('../server/wordpress');
const { renderListing, renderArticle, renderError } = require('../generated/blog-render.cjs');

module.exports = async function blog(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET','HEAD'].includes(req.method)) {
    res.setHeader('Allow','GET, HEAD');res.statusCode=405;res.end();return;
  }
  try {
    const url = new URL(req.url, 'https://mindpark.app');
    const query = req.query || Object.fromEntries(url.searchParams);
    const pathSlug = /^\/blog\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    const slug = pathSlug ? decodeURIComponent(pathSlug) : query.slug;
    const pageString = query.page || '1';
    if (typeof pageString !== 'string' || !/^\d+$/.test(pageString) || (slug && typeof slug !== 'string') || (query.topic && typeof query.topic !== 'string')) {
      const error = new Error('Invalid route');error.status=404;throw error;
    }
    const data = await loadBlog({ slug, topic:query.topic, page:Number(pageString) });
    const output = data.kind === 'article' ? renderArticle(data.post) : renderListing(data);
    res.statusCode=200;
    // Browser revalidates; Vercel serves a published snapshot for at most five minutes.
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=300');
    res.end(req.method === 'HEAD' ? '' : output);
  } catch (error) {
    res.statusCode = error.status === 404 || error instanceof URIError ? 404 : 503;
    res.setHeader('Cache-Control','no-store');
    res.end(req.method === 'HEAD' ? '' : renderError(res.statusCode));
  }
};
