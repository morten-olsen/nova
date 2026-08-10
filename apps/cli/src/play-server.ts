import { createServer, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gameRecordingMarker = '<!-- NOVA_GAME_RECORDING -->';
const webDirectory = join(dirname(require.resolve('@morten-olsen/nova-web/package.json')), 'dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const escapeScriptContent = (content: string): string => {
  return content.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
};

const escapeHtmlAttribute = (content: string): string => {
  return content.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};

const send = (response: ServerResponse, status: number, content: string | Uint8Array, contentType: string): void => {
  response.writeHead(status, { 'Content-Type': contentType });
  response.end(content);
};

const serveGame = async (response: ServerResponse, gameContent: string, gameName: string): Promise<void> => {
  const index = await readFile(join(webDirectory, 'index.html'), 'utf8');
  const gameScript = `<script type="application/vnd.project-nova.game+json" data-name="${escapeHtmlAttribute(gameName)}">${escapeScriptContent(gameContent)}</script>`;

  if (!index.includes(gameRecordingMarker)) {
    throw new Error('The bundled visualizer is missing its game recording placeholder. Reinstall Nova.');
  }

  send(response, 200, index.replace(gameRecordingMarker, gameScript), 'text/html; charset=utf-8');
};

const serveAsset = async (response: ServerResponse, pathname: string): Promise<void> => {
  const assetPath = resolve(webDirectory, `.${pathname}`);
  if (!assetPath.startsWith(`${webDirectory}${sep}`)) {
    send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  try {
    const content = await readFile(assetPath);
    send(response, 200, content, contentTypes[extname(assetPath)] ?? 'application/octet-stream');
  } catch {
    send(response, 404, 'Not found', 'text/plain; charset=utf-8');
  }
};

const createPlayServer = (gameContent: string, gameName: string): Server => {
  return createServer((request, response) => {
    void (async (): Promise<void> => {
      try {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        if (pathname === '/') {
          await serveGame(response, gameContent, gameName);
          return;
        }
        await serveAsset(response, pathname);
      } catch (error) {
        send(
          response,
          500,
          error instanceof Error ? error.message : 'Unable to load replay.',
          'text/plain; charset=utf-8',
        );
      }
    })();
  });
};

const listenOnRandomPort = async (server: Server): Promise<number> => {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine replay server port.');
  }
  return address.port;
};

export { createPlayServer, listenOnRandomPort };
