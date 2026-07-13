import { describe, expect, test } from 'bun:test';
import { isOpenApiUiEnabled, renderSwaggerUiHtml } from './openapiUi.ts';

describe('OpenAPI UI helpers', () => {
  test('renderSwaggerUiHtml embeds spec URL', () => {
    const html = renderSwaggerUiHtml('/api/openapi.json');
    expect(html).toContain('/api/openapi.json');
    expect(html).toContain('SwaggerUIBundle');
  });

  test('isOpenApiUiEnabled defaults off in production', () => {
    expect(isOpenApiUiEnabled('production', undefined)).toBe(false);
    expect(isOpenApiUiEnabled('development', undefined)).toBe(true);
    expect(isOpenApiUiEnabled(undefined, undefined)).toBe(true);
  });

  test('NETALIGN_OPENAPI_UI force flags', () => {
    expect(isOpenApiUiEnabled('production', '1')).toBe(true);
    expect(isOpenApiUiEnabled('development', '0')).toBe(false);
  });
});
