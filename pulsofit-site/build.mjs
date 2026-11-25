// Generador estático sin dependencias. Uso: node build.mjs  → carpeta dist/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SITE = { name: 'PulsoFit', url: (process.env.SITE_URL || 'https://pulsofit.com').replace(/\/$/, ''),
  desc: 'Noticias y tendencias fitness, explicadas con evidencia.', perPage: 10, byline: 'Redacción PulsoFit' };
const CATS = {
  'musculo-y-cultura': { name: 'Músculo y Cultura', desc: 'Entrenamiento, gimnasio y cultura fitness.' },
  'bienestar': { name: 'Bienestar', desc: 'Hábitos, recuperación, yoga y Pilates.' },
  'local-miami': { name: 'Local Miami', desc: 'Estudios, gimnasios, eventos y tendencias en Miami.' },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = d => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// ---- Frontmatter (subconjunto de YAML: clave: valor, y listas con "- ") ----
function parse(raw, file) {
  const m = raw.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: falta el bloque --- frontmatter ---`);
  const d = {}; let k = null;
  for (const l of m[1].split('\n')) {
    const li = l.match(/^\s+-\s+(.*)$/);
    if (li && k) { if (!Array.isArray(d[k])) d[k] = []; d[k].push(li[1].trim()); continue; }
    const kv = l.match(/^(\w+):\s*(.*)$/);
    if (kv) { k = kv[1]; d[k] = kv[2].trim().replace(/^["']|["']$/g, ''); }
  }
  for (const f of ['title', 'answer', 'date', 'category']) if (!d[f]) throw new Error(`${file}: falta "${f}"`);
  if (!CATS[d.category]) throw new Error(`${file}: categoría desconocida "${d.category}"`);
  return { d, body: m[2] };
}

// ---- Markdown mínimo: ##/###, párrafos, listas, > cita, **negrita**, *cursiva*, `código`, [enlace](https://) ----
const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
function md(t) {
  const out = []; let list = null, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inl(para.join(' '))}</p>`); para = []; } };
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of t.replace(/\r/g, '').split('\n')) {
    let m;
    if (!line.trim()) { flush(); close(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { flush(); close(); out.push(`<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); close(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/))) {
      flush(); const tag = /^\d/.test(line) ? 'ol' : 'ul';
      if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inl(m[1])}</li>`); continue;
    }
    close(); para.push(line.trim());
  }
  flush(); close(); return out.join('\n');
}

// ---- Plantilla base ----
const layout = ({ title, desc, path, body, type = 'website', ld = [], image }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE.url}${path}">
<meta name="color-scheme" content="dark"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE.url}${path}"><meta property="og:site_name" content="${SITE.name}">
${image ? `<meta property="og:image" content="${esc(image.startsWith('http') ? image : SITE.url + image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="alternate" type="application/rss+xml" title="${SITE.name}" href="/rss.xml"><link rel="stylesheet" href="/style.css">
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('')}</head>
<body><header class="top"><a class="brand" href="/">${SITE.name}</a><nav aria-label="Secciones">${Object.entries(CATS).map(([s, c]) => `<a href="/categoria/${s}/">${c.name}</a>`).join('')}</nav></header>
<main>${body}</main>
<footer><p>${SITE.name} publica contenido elaborado con ayuda de IA y revisado por la redacción.</p><p><a href="/sobre/">Sobre nosotros y política editorial</a> <a href="/rss.xml">RSS</a></p></footer></body></html>`;

const turn = (q, a, qTag = 'h2') => `<div class="turn"><${qTag} class="q">${q}</${qTag}><div class="a"><span class="av" aria-hidden="true">P</span><div>${a}</div></div></div>`;
const card = a => turn(`<a href="${a.url}">${esc(a.question || a.title)}</a>`,
  `<p>${esc(a.answer)}</p><p class="meta"><a href="/categoria/${a.category}/">${CATS[a.category].name}</a> <time datetime="${a.date}">${fmt(a.date)}</time></p>`);

// ---- Carga de artículos ----
const articles = readdirSync('content').filter(f => f.endsWith('.md')).map(f => {
  const { d, body } = parse(readFileSync(join('content', f), 'utf8'), f);
  const slug = d.slug || f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
  return { ...d, slug, url: `/articulos/${slug}/`, body, sources: Array.isArray(d.sources) ? d.sources : [] };
}).filter(a => a.draft !== 'true').sort((a, b) => new Date(b.date) - new Date(a.date));

// ---- Escritura ----
rmSync('dist', { recursive: true, force: true });
const write = (path, html) => { const f = path.endsWith('/') ? join('dist', path, 'index.html') : join('dist', path);
  mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
cpSync('assets', 'dist', { recursive: true });
if (existsSync('public')) cpSync('public', 'dist', { recursive: true });

function paginate(items, base, mk) {
  const pages = Math.max(1, Math.ceil(items.length / SITE.perPage));
  const href = p => p === 1 ? base : `${base}page/${p}/`;
  for (let p = 1; p <= pages; p++) {
    const nav = pages > 1 ? `<nav class="pager" aria-label="Páginas">${p > 1 ? `<a rel="prev" href="${href(p - 1)}">Más recientes</a>` : ''}<span>Página ${p} de ${pages}</span>${p < pages ? `<a rel="next" href="${href(p + 1)}">Anteriores</a>` : ''}</nav>` : '';
    write(href(p), mk(items.slice((p - 1) * SITE.perPage, p * SITE.perPage), nav, p, href(p)));
  }
}
const empty = '<p class="empty">Aún no hay artículos. Agrega archivos .md en la carpeta content/.</p>';

paginate(articles, '/', (items, nav, p, path) => layout({ title: p === 1 ? `${SITE.name}: ${SITE.desc}` : `Artículos, página ${p} | ${SITE.name}`,
  desc: SITE.desc, path, body: `<h1 class="hello">Pregunta lo que quieras saber de fitness. Aquí van las respuestas con fuentes.</h1>${items.map(card).join('') || empty}${nav}`,
  ld: p === 1 ? [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, inLanguage: 'es' }] : [] }));

for (const [slug, c] of Object.entries(CATS)) {
  paginate(articles.filter(a => a.category === slug), `/categoria/${slug}/`, (items, nav, p, path) => layout({ title: `${c.name}${p > 1 ? `, página ${p}` : ''} | ${SITE.name}`,
    desc: c.desc, path, body: `<h1 class="hello">${c.name}</h1><p class="lead">${c.desc}</p>${items.map(card).join('') || empty}${nav}` }));
}

for (const a of articles) {
  const c = CATS[a.category], person = !a.author || a.author.startsWith('Redacción') ? { '@type': 'Organization', name: a.author || SITE.byline } : { '@type': 'Person', name: a.author };
  const ld = [{ '@context': 'https://schema.org', '@type': a.type === 'guide' ? 'Article' : 'NewsArticle', headline: a.title, description: a.description || a.answer,
      datePublished: a.date, dateModified: a.updated || a.date, inLanguage: 'es', author: person, publisher: { '@type': 'Organization', name: SITE.name },
      mainEntityOfPage: SITE.url + a.url, ...(a.image ? { image: a.image.startsWith('http') ? a.image : SITE.url + a.image } : {}) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[SITE.name, '/'], [c.name, `/categoria/${a.category}/`], [a.title, a.url]]
      .map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE.url + u })) }];
  const src = a.sources.map(s => { const [n, u] = s.split('|').map(x => x.trim()); return `<li>${u ? `<a href="${esc(u)}" rel="noopener">${esc(n)}</a>` : esc(n)}</li>`; }).join('');
  write(a.url, layout({ title: `${a.title} | ${SITE.name}`, desc: a.description || a.answer, path: a.url, type: 'article', ld, image: a.image,
    body: `<article class="post"><p class="crumbs"><a href="/">Inicio</a> <a href="/categoria/${a.category}/">${c.name}</a></p>
${turn(esc(a.title), `<p>${esc(a.answer)}</p>`, 'h1')}
${a.image ? `<img class="cover" src="${esc(a.image)}" alt="${esc(a.image_alt || a.title)}" width="1200" height="630" loading="lazy">` : ''}
<div class="prose">${md(a.body)}</div>
${src ? `<aside class="sources"><h2>Fuentes</h2><ol>${src}</ol></aside>` : ''}
<p class="meta">Por ${esc(a.author || SITE.byline)}. Publicado <time datetime="${a.date}">${fmt(a.date)}</time>${a.updated ? `. Actualizado <time datetime="${a.updated}">${fmt(a.updated)}</time>` : ''}.</p></article>` }));
}

write('/sobre/', layout({ title: `Sobre nosotros y política editorial | ${SITE.name}`, desc: `Quién publica ${SITE.name}, cómo usamos IA y cómo corregimos errores.`, path: '/sobre/',
  body: `<h1 class="hello">Sobre ${SITE.name}</h1><div class="prose"><p>[PENDIENTE: nombre real del editor y del revisor de contenido de salud, y datos de la organización.]</p>
<h2>Cómo trabajamos</h2><p>Los artículos se redactan con ayuda de IA a partir de fuentes citadas al final de cada pieza. Una persona de la redacción los revisa antes de publicarlos.</p>
<h2>Correcciones</h2><p>Si encuentras un error, escríbenos. Corregimos y anotamos la fecha de actualización en el artículo.</p>
<h2>Contacto</h2><p>[PENDIENTE: correo de contacto]</p></div>` }));
write('/404.html', layout({ title: `Página no encontrada | ${SITE.name}`, desc: 'Página no encontrada.', path: '/404.html', body: '<h1 class="hello">No encontramos esa página.</h1><p class="lead"><a href="/">Vuelve al inicio</a> o elige una sección del menú.</p>' }));

const urls = ['/', '/sobre/', ...Object.keys(CATS).map(s => `/categoria/${s}/`), ...articles.map(a => a.url)];
const lastmod = Object.fromEntries(articles.map(a => [a.url, a.updated || a.date]));
write('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE.url}${u}</loc>${lastmod[u] ? `<lastmod>${new Date(lastmod[u]).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('')}</urlset>`);
write('/rss.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${SITE.name}</title><link>${SITE.url}</link><description>${esc(SITE.desc)}</description><language>es</language>${articles.slice(0, 20).map(a => `<item><title>${esc(a.title)}</title><link>${SITE.url}${a.url}</link><guid>${SITE.url}${a.url}</guid><pubDate>${new Date(a.date).toUTCString()}</pubDate><description>${esc(a.answer)}</description></item>`).join('')}</channel></rss>`);
write('/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
console.log(`OK: ${articles.length} artículos → dist/`);
