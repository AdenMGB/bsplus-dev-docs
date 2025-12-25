import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@ztl-uwu/nuxt-content',
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxtjs/color-mode',
    'nuxt-og-image',
    '@nuxt/scripts',
    '@nuxtjs/i18n',
    '@nuxt/fonts',
  ],
  shadcn: {
    prefix: 'Ui',
    componentDir: join(currentDir, './components/ui'),
  },
  components: {
    dirs: [
      {
        path: './components',
        ignore: ['**/*.ts'],
      },
    ],
  },
  i18n: {
    strategy: 'prefix_except_default',
  },
  colorMode: {
    classSuffix: '',
    disableTransition: true,
  },
  css: [
    join(currentDir, './assets/css/themes.css'),
    '~/assets/css/tailwind.css',
  ],
  content: {
    documentDriven: true,
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark',
      },
      preload: ['json', 'js', 'ts', 'html', 'css', 'vue', 'diff', 'shell', 'markdown', 'mdc', 'yaml', 'bash', 'ini', 'dotenv', 'rust', 'svelte', 'typescript'],
    },
    navigation: {
      fields: [
        'icon',
        'navBadges',
        'navTruncate',
        'badges',
        'toc',
        'sidebar',
        'collapse',
        'editLink',
        'prevNext',
        'breadcrumb',
        'fullpage',
      ],
    },
    experimental: {
      search: {
        indexed: true,
      },
    },
  },
  mdc: {
    highlight: {
      langs: ['json', 'js', 'ts', 'html', 'css', 'vue', 'diff', 'shell', 'markdown', 'mdc', 'yaml', 'bash', 'ini', 'dotenv', 'rust', 'svelte', 'typescript'],
    },
  },
  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 512,
    },
  },
  fonts: {
    defaults: {
      weights: ['300 800'],
    },
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        baseUrl: '.',
      },
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'exclude-native-bindings',
        resolveId(id) {
          // Exclude native bindings from resolution
          if (id.includes('.node') || (id.includes('resvgjs') && (id.includes('android') || id.includes('darwin') || id.includes('win32') || id.includes('linux')))) {
            return { id: 'data:text/javascript,export default {}', external: true };
          }
          return null;
        },
      },
    ],
    optimizeDeps: {
      include: ['debug'],
      exclude: ['@resvg/resvg-js'],
    },
  },
  nitro: {
    preset: 'cloudflare-pages',
    experimental: {
      wasm: true,
    },
    rollupConfig: {
      plugins: [
        {
          name: 'handle-node-builtins',
          resolveId(id, importer) {
            // Handle Node.js built-in modules FIRST (before other plugins)
            // Cloudflare Pages doesn't support these, so we provide polyfills
            if (id.startsWith('node:')) {
              const moduleName = id.replace('node:', '');
              return { id: `\0virtual:node-${moduleName}`, external: false };
            }
            return null;
          },
          load(id) {
            if (id.startsWith('\0virtual:node-')) {
              const moduleName = id.replace('\0virtual:node-', '');
              // Provide polyfills for common Node.js built-ins used by Nitro
              if (moduleName === 'buffer') {
                return `
                  // Polyfill for node:buffer in Cloudflare Pages
                  export const Buffer = globalThis.Buffer || class Buffer {
                    static from() { return new Uint8Array(); }
                    static alloc() { return new Uint8Array(); }
                    static isBuffer() { return false; }
                  };
                  export default Buffer;
                `;
              }
              if (moduleName === 'util') {
                return `
                  // Polyfill for node:util in Cloudflare Pages
                  export const promisify = (fn) => fn;
                  export const inspect = (obj) => JSON.stringify(obj);
                  export default { promisify, inspect };
                `;
              }
              if (moduleName === 'async_hooks') {
                return `
                  // Polyfill for node:async_hooks in Cloudflare Pages
                  // Simple AsyncLocalStorage implementation using Map
                  class AsyncLocalStorage {
                    constructor() {
                      this._store = new Map();
                    }
                    run(store, callback) {
                      const id = Symbol();
                      this._store.set(id, store);
                      try {
                        return callback();
                      } finally {
                        this._store.delete(id);
                      }
                    }
                    getStore() {
                      // Return first available store (simplified for Cloudflare)
                      for (const store of this._store.values()) {
                        return store;
                      }
                      return undefined;
                    }
                    enterWith(store) {
                      const id = Symbol();
                      this._store.set(id, store);
                    }
                    exit(callback) {
                      return callback();
                    }
                    disable() {
                      this._store.clear();
                    }
                    enable() {
                      // No-op
                    }
                  }
                  export { AsyncLocalStorage };
                  export default { AsyncLocalStorage };
                `;
              }
              // Default: empty export for other Node.js built-ins
              return 'export default {};';
            }
            return null;
          },
        },
        {
          name: 'exclude-native-bindings',
          resolveId(id, importer) {
            // Handle relative imports of .node files from @resvg/resvg-js
            if (id.includes('.node')) {
              return { id: '\0virtual:empty-node', external: false };
            }
            // Handle platform-specific resvg bindings
            if (id.includes('resvgjs') && (id.includes('android') || id.includes('darwin') || id.includes('win32') || id.includes('linux'))) {
              return { id: '\0virtual:empty-node', external: false };
            }
            return null;
          },
          load(id) {
            if (id === '\0virtual:empty-node') {
              return 'export default {};';
            }
            return null;
          },
        },
      ],
      external: (id) => {
        // Exclude all .node files (native bindings) from bundling
        if (id.includes('.node')) {
          return true;
        }
        // Mark node: built-ins as external (handled by plugin above)
        if (id.startsWith('node:')) {
          return false; // Let the plugin handle it
        }
        return false;
      },
    },
  },
  compatibilityDate: '2025-05-13',
});
