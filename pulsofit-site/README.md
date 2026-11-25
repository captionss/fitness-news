# PulsoFit: sitio estático (Fase 1, etapa 1)

Sin dependencias: solo necesita Node 18 o superior.

## Probar en local
    node build.mjs        # genera la carpeta dist/
    npx serve dist        # opcional, para verla en el navegador

## Publicar en Cloudflare Pages (gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En Cloudflare Pages, conecta el repositorio.
3. Build command: `node build.mjs`. Output directory: `dist`.
4. Variable de entorno `SITE_URL` con tu dominio real, por ejemplo `https://tudominio.com`.
5. Conecta el dominio personalizado y envía `https://tudominio.com/sitemap.xml` a Google Search Console y Bing Webmaster Tools.

## Cómo publicar un artículo (contrato para n8n)
n8n crea un archivo en `content/` con el nombre `AAAA-MM-DD-slug.md` mediante la API de GitHub. Cloudflare reconstruye el sitio solo.

    ---
    title: Titular del artículo
    question: Pregunta en lenguaje natural (opcional, se muestra como burbuja del usuario en el inicio)
    answer: Respuesta directa de 1-2 frases (obligatoria)
    description: Meta descripción (opcional; si falta se usa la respuesta)
    date: 2026-11-24
    updated: 2026-12-01        (opcional)
    category: musculo-y-cultura   (musculo-y-cultura | bienestar | local-miami)
    type: news                 (news | guide)
    author: Redacción PulsoFit (opcional)
    image: /img/portada.png    (opcional; guarda la imagen en public/img/)
    image_alt: Texto alternativo (opcional)
    draft: true                (opcional; si es true no se publica)
    sources:
      - Nombre de la fuente | https://url-de-la-fuente
    ---
    ## Subtítulo
    Texto con **negrita**, *cursiva*, [enlaces](https://...), listas con "-" y citas con ">".

Markdown admitido: `##`, `###`, párrafos, listas, citas, negrita, cursiva, código en línea y enlaces `https://`. Si algo falta o la categoría no existe, el build falla con un mensaje claro.

## Pendiente antes de salir en producción
- Borrar los dos artículos de muestra de `content/`.
- Completar la página `/sobre/` en `build.mjs` (editor real, revisor de salud, contacto).
- Cambiar nombre del sitio, secciones y `SITE_URL` en `build.mjs`.
