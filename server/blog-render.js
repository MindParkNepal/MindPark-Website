'use strict';
const sanitize = require('sanitize-html');
const { WP_ORIGIN, TOPICS } = require('./wordpress');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function plain(value) {
  return sanitize(String(value ?? ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n]);
}
function webURL(value, allowMail = false) {
  try { const url = new URL(value, WP_ORIGIN); return ['https:', 'http:', ...(allowMail ? ['mailto:'] : [])].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function articleURL(post) { return '/blog/' + encodeURIComponent(post.slug); }
function listURL(topic, page = 1) {
  const params = new URLSearchParams();
  if (topic) params.set('topic', topic);
  if (page > 1) params.set('page', page);
  return '/blog' + (params.size ? '?' + params : '');
}
function safeContent(value) {
  return sanitize(value || '', {
    allowedTags: [...sanitize.defaults.allowedTags, 'img', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src','alt','width','height','loading','decoding'], th:['scope','colspan','rowspan'], td:['colspan','rowspan'], ol:['start'], '*':['id'] },
    allowedSchemes: ['https','http','mailto'], allowProtocolRelative: false,
    transformTags: {
      h1: 'h2',
      a: (_, attrs) => {
        let href = attrs.href?.startsWith('#') ? attrs.href : webURL(attrs.href || '', true);
        if (href && !href.startsWith('#')) {
          const url = new URL(href);
          if (url.origin === WP_ORIGIN && !url.search && /^\/[a-z0-9%-]+\/?$/i.test(url.pathname) && !url.pathname.startsWith('/wp-')) href = '/blog/' + url.pathname.split('/').filter(Boolean)[0];
        }
        return { tagName:'a', attribs:{ href, title:attrs.title || '', rel:'noopener noreferrer' } };
      },
      img: (_, attrs) => ({ tagName:'img', attribs:{ src:webURL(attrs.src || ''), alt:attrs.alt || '', loading:'lazy', decoding:'async' } })
    }
  });
}
function featured(post, eager = false) {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const src = media?.source_url && webURL(media.source_url);
  return src ? `<img class="blog-image" src="${esc(src)}" alt="${esc(plain(media.alt_text || ''))}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : '';
}
function dateLabel(post) {
  const date = new Date((post.date_gmt || post.date) + (post.date_gmt ? 'Z' : ''));
  return Number.isNaN(date.valueOf()) ? '' : `<time datetime="${esc(date.toISOString())}">${esc(new Intl.DateTimeFormat('en',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date))}</time>`;
}
function layout({title, description, path, body, status = 200, image}) {
  const canonical = 'https://mindpark.app' + path;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | MindPark</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${path.startsWith('/blog/') ? 'article' : 'website'}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}${status !== 200 ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/img/MindParklogo.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet"><link href="/css/blog.css" rel="stylesheet">
</head><body><a class="skip-link" href="#main">Skip to content</a>
<header class="blog-header"><nav class="blog-nav" aria-label="Main navigation"><a class="blog-brand" href="/" aria-label="MindPark home"><img src="/img/MindParklogo.png" alt="" width="42" height="42">MindPark</a><div><a href="/#resources">Learning Center</a><a href="/blog"${path === '/blog' ? ' aria-current="page"' : ''}>All articles</a><a class="blog-button" href="/#download">Get the app</a></div></nav></header>
<main id="main">${body}</main>
<footer class="blog-footer"><div><a class="blog-brand" href="/">MindPark</a><p>Brain games, parent-guided screening, and development tracking for families.</p></div><nav aria-label="Footer"><a href="https://sites.google.com/view/mindpark-privacy-policy">Privacy Policy</a><a href="https://sites.google.com/view/mindpark-terms-and-conditions">Terms &amp; Conditions</a><a href="/#contact">Contact</a><a href="mailto:help@mindpark.app">help@mindpark.app</a></nav></footer></body></html>`;
}
function renderListing(data) {
  const title = data.topic ? data.topic.name : 'The MindPark Blog';
  const description = 'Practical reading for the questions that come up between conversations with your child’s healthcare professional.';
  const filters = [{slug:'',name:'All articles'}, ...TOPICS].map(t => `<a href="${esc(listURL(t.slug))}"${(data.topic?.slug || '') === t.slug ? ' aria-current="page"' : ''}>${esc(t.name)}</a>`).join('');
  const cards = data.posts.map(p => `<article class="blog-card"><a class="blog-card-image" href="${esc(articleURL(p))}" aria-label="${esc(plain(p.title?.rendered))}">${featured(p)}</a><div class="blog-card-copy"><div class="blog-date">${dateLabel(p)}</div><h2><a href="${esc(articleURL(p))}">${esc(plain(p.title?.rendered))}</a></h2><p>${esc(plain(p.excerpt?.rendered).trim().slice(0,210))}${plain(p.excerpt?.rendered).trim().length > 210 ? '…' : ''}</p><a class="blog-read" href="${esc(articleURL(p))}" aria-label="Read ${esc(plain(p.title?.rendered))}">Read article <span aria-hidden="true">→</span></a></div></article>`).join('');
  const empty = `<section class="blog-empty"><h2>More reading is on the way.</h2><p>${data.topic ? `There are no published articles in ${esc(data.topic.name)} yet.` : 'Our first articles will appear here when they are published.'}</p>${data.topic ? '<a class="blog-button" href="/blog">Explore all articles</a>' : '<a href="/">Return to MindPark</a>'}</section>`;
  const pager = data.pages > 1 ? `<nav class="blog-pagination" aria-label="Article pages">${data.page > 1 ? `<a href="${esc(listURL(data.topic?.slug,data.page-1))}" rel="prev">← Previous</a>` : '<span></span>'}<span>Page ${data.page} of ${data.pages}</span>${data.page < data.pages ? `<a href="${esc(listURL(data.topic?.slug,data.page+1))}" rel="next">Next →</a>` : '<span></span>'}</nav>` : '';
  return layout({ title, description, path:listURL(data.topic?.slug,data.page), body:`<section class="blog-hero"><div><p class="blog-eyebrow">MindPark Parent Learning Center</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div></section><section class="blog-container"><nav class="blog-filters" aria-label="Article topics">${filters}</nav>${cards ? `<div class="blog-grid">${cards}</div>` : empty}${pager}</section>` });
}
function renderArticle(post) {
  const title = plain(post.title?.rendered);
  const description = plain(post.excerpt?.rendered).trim().slice(0,160);
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const categories = (post._embedded?.['wp:term'] || []).flat().filter(t=>t.taxonomy==='category').map(t=>plain(t.name));
  const mins = Math.max(1, Math.ceil(plain(post.content?.rendered).split(/\s+/).length / 220));
  return layout({title,description,path:articleURL(post),image:media?.source_url && webURL(media.source_url),body:`<article class="blog-article"><a class="blog-back" href="/blog">← All articles</a><header><p class="blog-eyebrow">${esc(categories.join(' · ') || 'MindPark Parent Learning Center')}</p><h1>${esc(title)}</h1><div class="blog-date">${dateLabel(post)} <span aria-hidden="true">·</span> ${mins} min read</div>${featured(post,true)}</header><div class="blog-content">${safeContent(post.content?.rendered)}</div><div class="blog-article-bottom"><a class="blog-button" href="/blog">Explore more articles</a></div></article>`});
}
function renderError(status) {
  const missing = status === 404;
  const title = missing ? 'Page not found' : 'We couldn’t load the articles right now.';
  return layout({title,description:title,path:'/blog',status,body:`<section class="blog-container blog-empty"><p class="blog-eyebrow">MindPark Parent Learning Center</p><h1>${title}</h1><p>${missing ? 'This page may have moved or the article is no longer published.' : 'Please try again in a moment.'}</p><a class="blog-button" href="/blog">${missing ? 'Browse all articles' : 'Try again'}</a><p><a href="/">Return to MindPark</a></p></section>`});
}
module.exports = { renderListing, renderArticle, renderError, safeContent, plain, listURL };
