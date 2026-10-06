# MindPark blog

WordPress is the content source: https://mindparkapp.whf.bz
Public published posts are read through the WordPress REST API. No WordPress or hosting credentials are needed or stored in this repository.

## Visitor experience

- Homepage “Read article” links open `/blog?topic=...`, showing articles for that topic.
- “Read Blogs” opens `/blog`, listing all public articles, newest first, nine per page.
- Article cards open `/blog/article-slug` on MindPark, with the full article, featured image, and publication date.
- Empty topics show an honest empty state with a link to all articles.
- Missing, private, password-protected, and unpublished articles do not expose their content.

## Publishing in WordPress

Publish or edit a **Post** normally, including a title, body, featured image, and category. Assign the corresponding category slug below. WordPress usually generates the slug from the category name; check it under Posts → Categories. Child categories of a matched category are included.

| Homepage topic | Recognized category slugs |
| --- | --- |
| Autism & Development | `autism-development`, `autism`, `development`, `child-cognitive-development` |
| ADHD & Attention | `adhd-attention`, `adhd`, `attention` |
| Sleep | `sleep` |
| Anxiety | `anxiety` |
| Friendships | `friendships`, `friendship` |
| Daily Routines | `daily-routines`, `routines` |

The existing four posts in Child Cognitive Development appear under Autism & Development. Posts in other categories still appear in All articles. No WordPress content or categories were modified during integration.

On Vercel, successful pages are cached for up to five minutes. On a subsequent page request after expiry, fresh content is read from WordPress; this includes new posts, edits, and unpublishing. No new deployment is required for content updates after this integration is deployed. An already-open browser page needs a reload. WordPress/hosting caches may also affect freshness. Failed responses are not cached.

## Local development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
npm test
```

Visit http://127.0.0.1:8767 . The Node development server serves both static files and the same blog handler Vercel uses. A plain Python/static server cannot execute the blog routes. `PORT=8768 npm run dev` uses another port.

## Deployment

The current website remains a static website with one Vercel Node function (`api/blog.js`). `vercel.json` rewrites `/blog` and `/blog/:slug` to that function. No custom Vercel build step or secrets are required. Use the repository root as the project root and the Other/static framework preset if Vercel asks. Include `server/blog-render.bundle.cjs` with the source files when publishing: this prebuilt CommonJS renderer avoids Vercel's default restriction on requiring ESM dependencies. Rebuild it with `npm run build:blog` after renderer or dependency changes; development and tests also rebuild it automatically.

## Implementation

`server/wordpress.js` contains category mapping and WordPress requests with timeouts. `server/blog-render.js` is the editable renderer source; `scripts/build-blog.js` bundles it and the current sanitizer into `server/blog-render.bundle.cjs`, which the function loads. Article HTML is sanitized with `sanitize-html`; scripts, event handlers, forms, and embedded executable content are stripped. Tests run against the bundle with experimental ESM `require()` disabled, including startup in an isolated directory without `node_modules`. `css/blog.css` styles the blog independently of the homepage. Upstream errors produce a retry page instead of a blank screen. Public article images are served from WordPress, so that hosting must remain available.
