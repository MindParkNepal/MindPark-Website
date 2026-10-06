'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadBlog, topicCategoryIds, TOPICS } = require('../server/wordpress');
const { renderArticle, renderListing, safeContent } = require('../server/blog-render');
const handler = require('../api/blog');
const post = {id:28,slug:'a-real-post',status:'publish',date_gmt:'2026-09-01T08:06:08',title:{rendered:'A &amp; B'},excerpt:{rendered:'<p>Useful reading.</p>',protected:false},content:{rendered:'<p>Hello <strong>parents</strong>.</p>',protected:false}};
const response = (data, pages=1) => new Response(JSON.stringify(data),{headers:{'content-type':'application/json','x-wp-totalpages':String(pages),'x-wp-total':'4'}});

test('existing development category and its children map to the development topic',()=>{
  assert.deepEqual(topicCategoryIds(TOPICS[0],[{id:3,slug:'child-cognitive-development',parent:0},{id:5,slug:'early-years',parent:3},{id:6,slug:'sleep',parent:0}]),[3,5]);
});
test('topic listing fetches only matching categories, published posts, and requested page',async()=>{
  const calls=[];
  const data=await loadBlog({topic:'autism-development',page:2},async url=>{
    calls.push(new URL(url));return url.pathname.endsWith('/categories')?response([{id:3,slug:'child-cognitive-development',parent:0}]):response([post],3);
  });
  assert.equal(data.page,2);assert.equal(data.pages,3);
  assert.equal(calls[1].searchParams.get('categories'),'3');assert.equal(calls[1].searchParams.get('status'),'publish');assert.equal(calls[1].searchParams.get('page'),'2');
  const output=renderListing(data);assert.match(output,/topic=autism-development&amp;page=3/);assert.match(output,/\/blog\/a-real-post/);
});
test('missing topic category is honestly empty and never shows unrelated posts',async()=>{
  let calls=0;
  const data=await loadBlog({topic:'sleep'},async()=>{calls++;return response([{id:3,slug:'child-cognitive-development',parent:0}]);});
  assert.equal(calls,1);assert.deepEqual(data.posts,[]);assert.match(renderListing(data),/no published articles in Sleep/);
});
test('unknown topics and malformed pages do not contact WordPress',async()=>{
  const fail=()=>{throw new Error('Must not fetch');};
  for(const args of [{topic:'unknown'},{page:-1},{page:1.5},{slug:'../../private'}])await assert.rejects(loadBlog(args,fail),e=>e.status===404);
});
test('draft and protected articles are not rendered',async()=>{
  for(const p of [{...post,status:'draft'},{...post,content:{protected:true,rendered:''}}]){
    await assert.rejects(loadBlog({slug:post.slug},async()=>response([p])),e=>e.status===404);
  }
  const data=await loadBlog({},async()=>response([post,{...post,status:'private'}]));assert.equal(data.posts.length,1);
});
test('missing article and invalid upstream page are 404, upstream failure remains a service failure',async()=>{
  await assert.rejects(loadBlog({slug:'missing'},async()=>response([])),e=>e.status===404);
  await assert.rejects(loadBlog({page:3},async()=>new Response(JSON.stringify({code:'rest_post_invalid_page_number'}),{status:400})),e=>e.status===404);
  await assert.rejects(loadBlog({},async()=>new Response('Down',{status:500})),e=>e.status===502);
});
test('article HTML preserves formatting but removes executable content and dangerous attributes',()=>{
  const clean=safeContent('<script>alert(1)</script><p onclick="evil()" style="position:fixed">Hello <strong>world</strong></p><a href="javascript:alert(1)">Bad</a><img src="x.jpg" onerror="evil()"><iframe src="https://evil.test"></iframe><svg onload="evil()"></svg><form action="javascript:evil()"></form>');
  assert.match(clean,/<strong>world<\/strong>/);
  assert.doesNotMatch(clean,/script|onclick|onerror|style=|iframe|<svg|<form|javascript:/i);
  assert.match(clean,/https:\/\/mindparkapp.whf.bz\/x.jpg/);
  assert.match(safeContent('<a href="https://mindparkapp.whf.bz/another-post/">Next</a>'),/href="\/blog\/another-post"/);
});
test('article page renders actual content, clean title, canonical URL, and no admin credentials',()=>{
  const output=renderArticle(post);assert.match(output,/<h1>A &amp; B<\/h1>/);assert.match(output,/https:\/\/mindpark.app\/blog\/a-real-post/);assert.match(output,/<strong>parents<\/strong>/);assert.doesNotMatch(output,/wp-admin|password|application_password/i);
});
function capture(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body||'';}};}
test('function caches successful responses for five minutes and never caches errors',async t=>{
  t.mock.method(global,'fetch',async()=>response([post]));
  const ok=capture();await handler({method:'GET',url:'/blog'},ok);assert.equal(ok.statusCode,200);assert.equal(ok.headers['Vercel-CDN-Cache-Control'],'public, s-maxage=300');
  global.fetch=async()=>{throw new Error('Network down');};
  const failed=capture();await handler({method:'GET',url:'/blog'},failed);assert.equal(failed.statusCode,503);assert.equal(failed.headers['Cache-Control'],'no-store');assert.match(failed.body,/try again/i);
});
test('function supports article rewrites and HEAD; rejects writes',async t=>{
  t.mock.method(global,'fetch',async()=>response([post]));
  for(const url of ['/blog/a-real-post','/api/blog?slug=a-real-post']){
    const res=capture();await handler({method:'GET',url},res);assert.equal(res.statusCode,200);assert.match(res.body,/<h1>A &amp; B/);
  }
  const head=capture();await handler({method:'HEAD',url:'/blog'},head);assert.equal(head.statusCode,200);assert.equal(head.body,'');
  const write=capture();await handler({method:'POST',url:'/blog'},write);assert.equal(write.statusCode,405);
});
