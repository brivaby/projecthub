const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const sourceRoot = path.resolve(process.env.PROJECTHUB_SUBMISSIONS || path.join(root, '..', 'Student Web Projects'));
const sourcePrefix = path.relative(root, sourceRoot).split(path.sep).map(encodeURIComponent).join('/');
const fromProject = name => require(path.join(root, 'node_modules', name));
const esbuild = fromProject('esbuild');
const submissions = [
  ['trailquiz','TrailQuiz','An interactive learning dashboard with quizzes and progress tracking.','Education','Ariho Ryan Asiimwe','violet',['HTML','CSS','JavaScript'],'Ariho Ryan Asiimwe Project'],
  ['clean-environment','Keeping Our Environment Clean','A website about keeping the environment clean.','Environmental Science','Darlene Mich','forest',['HTML'],'Darlene  Mich Project.zip'],
  ['children-in-uganda','The Underrepresentation of Children in Uganda','An informational website about children’s representation and participation in Uganda.','Social Sciences','Elata Eku Dolo','clay',['HTML'],'Elata Eku Dolo Project/Computer Project.zip'],
  ['girls-have-a-voice','Girls Have a Voice','A website about including girls in the decisions that affect them in Uganda.','Social Sciences','Elata Eku Dolo','clay',['HTML'],'Elata Eku Dolo Project/underrepresentationofchildreninuganda.zip'],
  ['clean-campus','Clean Campus Rewards','A campus cleanliness rewards site with challenges, houses, and a leaderboard.','Environmental Science','Elizabeth Tamali Nelima','forest',['HTML','CSS','JavaScript'],'Elizabeth Tamali Nelima.zip'],
  ['daybook','Daybook','An assignment planner that tracks dates and saves assignments locally.','Education','Isaac Nsibambi','gold',['HTML','CSS','JavaScript'],'Isaac  Nsibambi Project.zip'],
  ['javris','Javris','A Java Swing chat assistant that responds to greetings and reports the date and time.','Computer Science','Joel Sherezo','slate',['Java','Swing'],'Joel  Sherezo Project/Javris'],
  ['assign-time','Assign Time','Assignment-planning JavaScript with date views, filters, and reminder settings.','Education','Joshua Ndikuwera','ocean',['JavaScript'],'Joshua Ndikuwera’s Project.zip'.replace('’', "'")],
  ['windy-days','Windy Days','A character-based browser game that teaches players about child nutrition and malnutrition.','Health Sciences','Julie Veronica Serugo','violet',['HTML','CSS','JavaScript'],'Julie Veronica Serugo Project/Windy Dayssss.html']
];
const entrypoints = {
 'trailquiz':'index.html',
 'clean-environment':'index.html',
 'children-in-uganda':'Computer Project/underrepresentationofchildreninuganda.html',
 'girls-have-a-voice':'underrepresentationofchildreninuganda.html',
 'clean-campus':'index.html',
 'daybook':'vs code/index.html',
 'assign-time':'index.html',
 'windy-days':'index.html'
};
const sourceViews = Object.fromEntries([['assign-time','app.js'],['javris','Main.java']].map(([id,entry])=>[id,fs.readFileSync(path.join(root,'preview-projects',id,entry),'utf8').replace('\r\n', '\n').trimEnd()]));
const manifestPath = process.env.PROJECTHUB_PREVIEW_MANIFEST;
const incoming = JSON.parse(manifestPath
  ? fs.readFileSync(manifestPath, 'utf8')
  : (process.env.PROJECTHUB_PREVIEW_SUBMISSIONS || '[]'));
const previewPaths = {};
for (const project of incoming) {
  submissions.push(project.card);
  entrypoints[project.card[0]] = project.entry;
  if (project.previewPath) previewPaths[project.card[0]] = project.previewPath;
}
const projectModule = `
const submissions = ${JSON.stringify(submissions.map(row=>[...row, fs.statSync(path.join(sourceRoot,row[7]), {throwIfNoEntry:false})?.mtime.toISOString()]))};
const entrypoints = ${JSON.stringify(entrypoints)};
const sourceViews = ${JSON.stringify(sourceViews)};
const previewPaths = ${JSON.stringify(previewPaths)};
export const projects = submissions.map(([id,title,summary,category,name,cover,technologies,source,updatedAt])=>({
  id,title,summary,category:{name:category}, owner:{id:encodeURIComponent(name.toLowerCase().replaceAll(' ','-')),name}, cover,technologies,source,
  entry:entrypoints[id], previewPath:previewPaths[id] || (entrypoints[id] && id+'/'+entrypoints[id]),
  sourceText:sourceViews[id], hasOriginal:Boolean(updatedAt), updatedAt:updatedAt ? new Date(updatedAt) : null, files:[], featured:false, collaboration:'CLOSED', institution:{name:'Vic Academy'}
}));
export const categories = Array.from(new Set(projects.map(p=>p.category.name))).map(name=>({name,_count:{projects:projects.filter(p=>p.category.name===name).length}}));
export const creators = Array.from(new Map(projects.map(p=>[p.owner.id,p.owner])).values()).map(u=>({...u,profile:{institution:'Vic Academy'},_count:{projects:projects.filter(p=>p.owner.id===u.id).length}}));
export const cardInclude = {};
export const discover = async (params={})=>({projects:params?.sort==='newest' ? [...projects].sort((a,b)=>b.updatedAt-a.updatedAt) : projects,total:projects.length});
export const metrics = ()=>({views:0,likes:0,bookmarks:0,clones:0,collaborations:0});
`;
const ui = fs.readFileSync('src/components/ui.tsx','utf8').replace(
  'export function ProjectCard({',
  String.raw`export function SubmissionCover({project}) {
    if (project.entry) {
      const source = 'preview-projects/' + project.previewPath.split('/').map(encodeURIComponent).join('/');
      return <div className="cover submission-cover" aria-hidden="true" inert>
        <iframe src={source} title={project.title + ' page preview'} loading="lazy" sandbox="" referrerPolicy="no-referrer" tabIndex={-1}/>
      </div>;
    }
    const excerpt = project.sourceText?.split(/\r?\n/).slice(15, 25).join('\n');
    return <div className="cover submission-code" aria-label="Excerpt from the submitted Main.java">
      <span>Main.java</span><pre><code>{excerpt}</code></pre>
    </div>;
  }
  export function ProjectCard({`
).replace(
  /(<article className="project-card">\s*)(<Link[\s\S]*?className="card-cover"[\s\S]*?>)\s*<Cover kind=\{p.cover\} title=\{p.title\} imageId=\{p.files\[0\]\?\.id\} \/>([\s\S]*?<\/Link>)/,
  '$1<div className="submission-cover-wrap"><SubmissionCover project={p}/>$2$3</div>'
).replace(
  /<span className="updated">[\s\S]*?<\/span>/,
  '{p.updatedAt && $&}'
);
const modules = {
  '@/components/ui':ui,
  'next/navigation': 'export const usePathname = () => null;',
  'next/link': `const entries = ${JSON.stringify(entrypoints)};
    const previewPaths = ${JSON.stringify(previewPaths)};
    export default function Link({href, target, rel, ...props}) {
      const id = href.startsWith('/projects/') ? href.slice('/projects/'.length) : '';
      const entry = entries[id];
      const destination = entry ? 'preview-projects/' + (previewPaths[id] || id+'/'+entry).split('/').map(encodeURIComponent).join('/') : href === '/' ? '#' : '#' + href;
      return <a href={destination} target={entry ? '_blank' : target} rel={entry ? 'noopener noreferrer' : rel} {...props}/>;
    }`,
  '@/auth': 'export const auth=async()=>null; export const signOut=async()=>{};',
  '@/lib/projects': projectModule,
  '@/lib/recommendations': 'export {discover as recommendations} from "@/lib/projects";',
  '@/lib/db': 'import {projects,categories,creators} from "@/lib/projects"; export const db={project:{findMany:async()=>projects.filter(p=>p.featured),count:async()=>projects.length},category:{findMany:async()=>categories},user:{findMany:async()=>creators}};',
};
esbuild.buildSync;
(async()=>{
const result=await esbuild.build({stdin:{sourcefile:'preview.jsx',loader:'jsx',resolveDir:root,contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Header,Footer} from '@/components/shell';
import Home from '@/app/page';
import {ProjectCard,SubmissionCover,Avatar} from '@/components/ui';
import {ArrowRight,ArrowUpRight,Search} from 'lucide-react';
import {projects,categories,creators} from '@/lib/projects';
export async function render(){
return renderToStaticMarkup(<><a className="skip-link" href="#main">Skip to content</a>{await Header()}
<main id="main"><div id="home">{await Home()}</div><section id="preview-page" className="container section" hidden></section></main><Footer/>
<template id="catalog">
  <header className="catalog-intro">
    <div>
      <h1 id="catalog-title" tabIndex={-1}>Explore student projects</h1>
      <p>Discover the websites, games and tools built by Vic Academy students.</p>
    </div>
    <dl className="catalog-totals">
      <div><dt>Projects</dt><dd>{projects.length}</dd></div>
      <div><dt>Creators</dt><dd>{creators.length}</dd></div>
    </dl>
  </header>
  <form id="catalog-search" className="catalog-filters" aria-label="Filter projects">
    <label className="catalog-search-field">Search projects
      <span><Search aria-hidden="true" size={18}/><input name="q" type="search" placeholder="Title, student or technology"/></span>
    </label>
    <label><span id="catalog-category-label">Category</span>
      <select name="category" aria-labelledby="catalog-category-label">
        <option value="">All categories</option>
        {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
      </select>
    </label>
    <label><span id="catalog-sort-label">Sort by</span>
      <select name="sort" aria-labelledby="catalog-sort-label">
        <option value="newest">Newest first</option>
        <option value="title">Project name</option>
      </select>
    </label>
    <button className="button" type="submit">Apply filters</button>
  </form>
  <div className="catalog-result-line">
    <p id="results" role="status" aria-atomic="true"></p>
    <a href="#/explore" data-reset-filters hidden>Clear filters</a>
  </div>
  <div className="project-grid catalog-grid">
    {projects.map(p=>{
      const projectPage = p.entry && 'preview-projects/'+p.previewPath.split('/').map(encodeURIComponent).join('/');
      const details = '#/projects/'+p.id;
      return <article className="catalog-card" key={p.id} data-category={p.category.name} data-project-title={p.title} data-updated={p.updatedAt?.getTime() ?? ''} data-search={[p.title,p.summary,p.owner.name,p.category.name,...p.technologies].join(' ').toLowerCase()}>
        <div className="catalog-card-preview">
          <SubmissionCover project={p}/>
          <a className="catalog-cover-link" href={projectPage || details} target={p.entry ? '_blank' : undefined} rel={p.entry ? 'noopener noreferrer' : undefined} aria-label={p.entry ? 'Open '+p.title+' (new tab)' : 'View source for '+p.title}>
            <span>{p.entry ? 'Open project' : 'View source'} {p.entry ? <ArrowUpRight aria-hidden="true" size={16}/> : <ArrowRight aria-hidden="true" size={16}/>}</span>
          </a>
        </div>
        <div className="catalog-card-body">
          <p className="catalog-card-category">{p.category.name}</p>
          <h2><a href={projectPage || details} target={p.entry ? '_blank' : undefined} rel={p.entry ? 'noopener noreferrer' : undefined}>{p.title}<span className="sr-only">{p.entry ? ' (new tab)' : ''}</span></a></h2>
          <p className="catalog-card-summary">{p.summary}</p>
          <div className="tags">{p.technologies.map(t=><span key={t}>{t}</span>)}</div>
          <div className="catalog-card-footer">
            <a href={'#/people/'+p.owner.id} className="catalog-card-student"><Avatar name={p.owner.name}/><span>{p.owner.name}</span></a>
            <a href={details} className="preview-details" aria-label={'Details for '+p.title}>Details <ArrowRight aria-hidden="true" size={14}/></a>
          </div>
        </div>
      </article>;
    })}
  </div>
  <section className="catalog-empty" hidden>
    <h2>No projects match these filters</h2>
    <p>Try a different search or choose another category.</p>
    <a className="button secondary" href="#/explore">See all projects</a>
  </section>
</template>
<template id="categories"><h1>Categories</h1><div className="subject-grid">{categories.map(c=><a key={c.name} href={'#/explore?category='+encodeURIComponent(c.name)}><h3>{c.name}</h3><span>{c._count.projects} projects</span></a>)}</div></template>
<template id="community"><h1>Vic Academy community</h1>{creators.map(u=><p key={u.id}><a href={'#/people/'+u.id}>{u.name}</a> · {u._count.projects} projects</p>)}</template>
{creators.map(u=><template key={u.id} id={'/people/'+u.id}><h1>{u.name}</h1><p>Vic Academy</p><div className="project-grid">{projects.filter(p=>p.owner.id===u.id).map(p=><ProjectCard key={p.id} project={p}/>)}</div></template>)}
{projects.map(p=><template key={p.id} id={'/projects/'+p.id}><a href="#/explore">← Explore projects</a><h1>{p.title}</h1><p>{p.category.name} · {p.owner.name} · Vic Academy</p><div className="detail-submission-preview"><SubmissionCover project={p}/></div><p>{p.summary}</p><div className="tags">{p.technologies.map(t=><span key={t}>{t}</span>)}</div>{p.entry && <p><a className="button" href={'preview-projects/'+p.previewPath.split('/').map(encodeURIComponent).join('/')} target="_blank" rel="noopener noreferrer">{p.id==='assign-time' ? 'Open browser demo' : 'Open project'}</a></p>}
{p.id==='assign-time' && <p>The submission contains the JavaScript. This demo supplies the page it runs on.</p>}
{p.id==='windy-days' && <p>The preview uses stand-in character art and the original gradient background because the image files were absent.</p>}
{p.id==='javris' && <p>Javris is a Java Swing desktop project. Its source is available below.</p>}
{p.sourceText && <details><summary>View submitted source</summary><pre className="preview-source"><code>{p.sourceText}</code></pre></details>}
{p.hasOriginal && <p><a className="button secondary" href={${JSON.stringify(sourcePrefix ? sourcePrefix + '/' : './')} + p.source.split('/').map(encodeURIComponent).join('/')} download={p.source.endsWith('.html') ? undefined : p.source.endsWith('Javris') ? 'Javris.java' : p.id==='trailquiz' ? 'TrailQuiz.zip' : true} target={p.source.endsWith('.html') ? '_blank' : undefined} rel="noopener noreferrer">{p.source.endsWith('.html') ? 'Open submitted page' : 'Download original submission'}</a></p>}</template>)}</>);
}
`},bundle:true,platform:'node',format:'cjs',jsx:'automatic',outfile:path.join(root,'preview-build.cjs'),write:false,external:['react','react-dom/server'],plugins:[{name:'preview',setup(build){
 build.onResolve({filter:/^(next\/(?:link|navigation)|@\/)/},args=> Object.hasOwn(modules,args.path)?{path:args.path,namespace:'preview'}:undefined);
 build.onLoad({filter:/.*/,namespace:'preview'},args=>({contents:modules[args.path],loader:args.path==='@/components/ui'?'tsx':'jsx',resolveDir:root}));
}}]});
const Module=require('node:module');
const filename=path.join(root,'preview-build.cjs');
const compiled=new Module(filename,module);
compiled.filename=filename;
compiled.paths=module.paths.concat(path.join(root,'node_modules'));
compiled._compile(result.outputFiles[0].text,filename);
const body=await compiled.exports.render();
const style=fs.readFileSync('src/app/globals.css','utf8').replace(/^@tailwind .*;$/gm,'')
  +'\n'+fs.readFileSync('scripts/preview.css','utf8');
const script=`
const home=document.getElementById('home');
const page=document.getElementById('preview-page');
function show(focusHeading=false){
 const [route,query]=location.hash.slice(1).split('?');
 const params=new URLSearchParams(query);
 if(!route||route==='/'){home.hidden=false;page.hidden=true;return;}
 if(!route.startsWith('/'))return;
 home.hidden=true;page.hidden=false;page.replaceChildren();
 const catalog=route==='/explore'||route==='/trending';
 const template=document.getElementById(catalog?'catalog':route.slice(1))||document.getElementById(route);
 if(template)page.append(template.content.cloneNode(true));
 if(catalog){
  const form=page.querySelector('#catalog-search');
  const query=params.get('q')||'';
  const category=params.get('category')||'';
  const sort=params.get('sort')==='title'?'title':'newest';
  form.elements.q.value=query;
  form.elements.category.value=category;
  form.elements.sort.value=sort;
  const grid=page.querySelector('.catalog-grid');
  const cards=[...grid.children];
  cards.sort((a,b)=>sort==='title'
    ? a.dataset.projectTitle.localeCompare(b.dataset.projectTitle)
    : Number(b.dataset.updated)-Number(a.dataset.updated));
  const terms=query.toLowerCase().trim().split(/\\s+/).filter(Boolean);
  let count=0;
  for(const card of cards){
   card.hidden=!(terms.every(term=>card.dataset.search.includes(term))&&(!category||card.dataset.category===category));
   if(!card.hidden)count++;
   grid.append(card);
  }
  grid.hidden=!count;
  page.querySelector('.catalog-empty').hidden=Boolean(count);
  page.querySelector('[data-reset-filters]').hidden=!query.trim()&&!category&&sort==='newest';
  page.querySelector('#results').textContent=count+' '+(count===1?'project':'projects')+' found';

 }
 if(!template){
  const title=document.createElement('h1');
  title.textContent=route.slice(1).replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
  const message=document.createElement('p');
  message.textContent='This feature requires the live ProjectHub server.';
  page.append(title,message);
 }
 window.scrollTo(0,0);
 if(focusHeading){
  const heading=page.querySelector('h1');
  if(heading){
   heading.tabIndex=-1;
   heading.focus({preventScroll:true});
  }
 }
}
document.addEventListener('submit',event=>{
 if(!event.target.matches('.hero-search, #catalog-search'))return;
 event.preventDefault();
 const params=new URLSearchParams(new FormData(event.target));
 for(const name of ['q','category','sort']){
  const value=params.get(name);
  if(!value?.trim()||(name==='sort'&&value==='newest'))params.delete(name);
 }
 const query=params.toString();
 location.hash=query?'/explore?'+query:'/explore';
});
let theme='light';
try { theme=localStorage.getItem('vic-theme')||'light'; } catch {}
const themeButton=document.querySelector('.theme-toggle');
function paintTheme(){document.documentElement.dataset.theme=theme;themeButton.textContent=theme==='dark'?'☀ Light mode':'◐ Dark mode';themeButton.setAttribute('aria-label',theme==='dark'?'Use light mode':'Use dark mode');}
themeButton.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';paintTheme();try{localStorage.setItem('vic-theme',theme);}catch{}});
paintTheme();
let currentRevision;
window.projectHubCatalogRevision = revision => {
 if(currentRevision && currentRevision!==revision) location.reload();
 currentRevision=revision;
};
function checkCatalog(){
 const signal=document.createElement('script');
 signal.src='preview-projects/catalog-version.js?'+Date.now();
 signal.onload=signal.onerror=()=>signal.remove();
 document.head.append(signal);
}
checkCatalog();
setInterval(checkCatalog,5000);
window.addEventListener('hashchange',()=>show(true));
show();
`;
const output = 'ProjectHub Preview.html';
const temporary = output + '.' + process.pid + '.tmp';
fs.writeFileSync(temporary,'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vic Academy ProjectHub Preview</title><style>'+style+'</style></head><body><p class="preview-notice">Offline preview · Student submissions</p>'+body+'<script>'+script+'</script></body></html>');
fs.renameSync(temporary, output);
})().catch(e=>{console.error(e);process.exitCode=1;});
