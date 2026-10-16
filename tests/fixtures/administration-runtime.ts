// Real workerd SQLite Durable Object runtime shared by API and browser tests.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import ts from 'typescript';
import type {AdministrationBinding} from '../../worker/administration.ts';

export async function administrationRuntime(persistence?: string) {
  const files = [
    'worker/administration.ts',
    'src/lib/dashboard/settings.ts',
    'src/lib/dashboard/config.ts',
    'src/lib/photos/contracts.ts',
  ];
  const modules = await Promise.all(
    files.map(async (file) => ({
      type: 'ESModule' as const,
      path: path.resolve(file),
      contents: ts.transpileModule(await readFile(file, 'utf8'), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    })),
  );
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        {
          type: 'ESModule',
          path: path.resolve('m4-test-entry.js'),
          contents:
            "export {Administration} from './worker/administration.ts'; export default {fetch() {return new Response('test')}};",
        },
        ...modules,
      ],
      compatibilityDate: '2026-10-16',
      resourcePersistencePath: persistence,
      durableObjects: {
        ADMINISTRATION: {className: 'Administration', useSQLite: true},
      },
    }),
  );
  return {
    runtime,
    binding: (await runtime.getDurableObjectNamespace(
      'ADMINISTRATION',
    )) as unknown as AdministrationBinding,
  };
}
