/**
 * Minimal Swagger UI HTML (CDN assets). Intended for non-production only.
 */
export function renderSwaggerUiHtml(specUrl = '/api/openapi.json'): string {
  const safeUrl = specUrl.replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NetAlign API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #1b1b1b; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "${safeUrl}",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
}

export function isOpenApiUiEnabled(
  nodeEnv: string | undefined = Bun.env.NODE_ENV ?? process.env.NODE_ENV,
  forceFlag: string | undefined = Bun.env.NETALIGN_OPENAPI_UI ?? process.env.NETALIGN_OPENAPI_UI,
): boolean {
  if (forceFlag === '1' || forceFlag === 'true') return true;
  if (forceFlag === '0' || forceFlag === 'false') return false;
  return nodeEnv !== 'production';
}
