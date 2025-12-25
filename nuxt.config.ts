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
    // Temporarily disabled to reduce memory usage during Cloudflare Pages build
    // 'nuxt-og-image',
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
    // Optimize memory usage
    minify: true,
    sourceMap: false,
    compressPublicAssets: true,
    rollupConfig: {
      // Optimize memory usage during build
      treeshake: {
        moduleSideEffects: false,
      },
      plugins: [
        {
          name: 'handle-node-builtins',
          resolveId(id, importer) {
            // Only handle node: imports during production build for Cloudflare Pages
            // Skip during dev mode where Node.js built-ins are available
            // eslint-disable-next-line node/prefer-global/process
            const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI;

            if (isDev) {
              // In dev mode, let Node.js handle node: imports naturally
              return null;
            }

            // During build, provide polyfills for Cloudflare Pages
            // Only intercept if it's actually being imported (not already resolved)
            if (id.startsWith('node:') && importer) {
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
              if (moduleName === 'fs/promises') {
                return `
                  // Polyfill for node:fs/promises in Cloudflare Pages
                  // Cloudflare Pages doesn't support file system access
                  // These are no-op implementations for development error handling
                  export const readFile = async () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const writeFile = async () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const readdir = async () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const stat = async () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const access = async () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export default {
                    readFile,
                    writeFile,
                    readdir,
                    stat,
                    access,
                  };
                `;
              }
              if (moduleName === 'fs') {
                return `
                  // Polyfill for node:fs in Cloudflare Pages
                  // Cloudflare Pages doesn't support file system access
                  const fsPromises = {
                    readFile: async () => {
                      throw new Error('File system access not available in Cloudflare Pages');
                    },
                    writeFile: async () => {
                      throw new Error('File system access not available in Cloudflare Pages');
                    },
                    readdir: async () => {
                      throw new Error('File system access not available in Cloudflare Pages');
                    },
                    stat: async () => {
                      throw new Error('File system access not available in Cloudflare Pages');
                    },
                    access: async () => {
                      throw new Error('File system access not available in Cloudflare Pages');
                    },
                  };
                  export const promises = fsPromises;
                  export const readFileSync = () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const writeFileSync = () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const readdirSync = () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export const statSync = () => {
                    throw new Error('File system access not available in Cloudflare Pages');
                  };
                  export default {
                    promises: fsPromises,
                    readFileSync,
                    writeFileSync,
                    readdirSync,
                    statSync,
                  };
                `;
              }
              if (moduleName === 'path') {
                return `
                  // Polyfill for node:path in Cloudflare Pages
                  // Basic path utilities using string manipulation
                  const normalizeSlashes = (str) => str.replace(/[\\\\/]+/g, '/');
                  export const resolve = (...paths) => {
                    const joined = paths.filter(p => p).join('/');
                    return normalizeSlashes(joined);
                  };
                  export const dirname = (path) => {
                    const parts = normalizeSlashes(path).split('/');
                    parts.pop();
                    return parts.join('/') || '/';
                  };
                  export const basename = (path, ext) => {
                    const parts = normalizeSlashes(path).split('/');
                    const name = parts[parts.length - 1];
                    return ext ? name.replace(ext, '') : name;
                  };
                  export const join = (...paths) => {
                    const joined = paths.filter(p => p).join('/');
                    return normalizeSlashes(joined);
                  };
                  export const extname = (path) => {
                    const normalized = normalizeSlashes(path);
                    const match = normalized.match(/\\.[^.]+$/);
                    return match ? match[0] : '';
                  };
                  export default {
                    resolve,
                    dirname,
                    basename,
                    join,
                    extname,
                  };
                `;
              }
              if (moduleName === 'url') {
                return `
                  // Polyfill for node:url in Cloudflare Pages
                  export const fileURLToPath = (url) => {
                    if (typeof url === 'string') {
                      url = new URL(url);
                    }
                    // Convert file:// URL to path
                    let pathname = url.pathname;
                    // Decode URL-encoded characters
                    try {
                      pathname = decodeURIComponent(pathname);
                    } catch (e) {
                      // If decoding fails, use original
                    }
                    // Remove leading slash on Windows (file:///C:/path -> C:/path)
                    if (pathname.startsWith('/') && /^[a-zA-Z]:/.test(pathname.slice(1))) {
                      pathname = pathname.slice(1);
                    }
                    return pathname;
                  };
                  export const pathToFileURL = (path) => {
                    // Convert path to file:// URL
                    const pathname = path.replace(/\\\\/g, '/');
                    return new URL('file://' + (pathname.startsWith('/') ? '' : '/') + pathname);
                  };
                  export const URL = globalThis.URL;
                  export const URLSearchParams = globalThis.URLSearchParams;
                  export default {
                    fileURLToPath,
                    pathToFileURL,
                    URL,
                    URLSearchParams,
                  };
                `;
              }
              if (moduleName === 'worker_threads') {
                return `
                  // Polyfill for node:worker_threads in Cloudflare Pages
                  // Cloudflare Pages doesn't support worker threads
                  // Provide minimal implementations for Nitro dev mode
                  export const parentPort = null;
                  export const threadId = 0;
                  export const Worker = class Worker {
                    constructor() {
                      throw new Error('Worker threads not available in Cloudflare Pages');
                    }
                  };
                  export default {
                    parentPort,
                    threadId,
                    Worker,
                  };
                `;
              }
              if (moduleName === 'crypto') {
                return `
                  // Polyfill for node:crypto in Cloudflare Pages
                  // Use Web Crypto API which is available in Cloudflare Pages
                  export const randomBytes = (size) => {
                    const array = new Uint8Array(size);
                    crypto.getRandomValues(array);
                    return array;
                  };
                  export const createHash = (algorithm) => {
                    return {
                      update: (data) => {
                        return {
                          digest: async (encoding) => {
                            const hashBuffer = await crypto.subtle.digest(algorithm, typeof data === 'string' ? new TextEncoder().encode(data) : data);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            if (encoding === 'hex') {
                              return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                            }
                            return hashArray;
                          },
                        };
                      },
                    };
                  };
                  export default {
                    randomBytes,
                    createHash,
                  };
                `;
              }
              if (moduleName === 'http') {
                return `
                  // Polyfill for node:http in Cloudflare Pages
                  // Cloudflare Pages uses Cloudflare Workers runtime, not Node.js HTTP server
                  // Provide minimal implementations for Nitro build
                  export class Server {
                    constructor() {
                      throw new Error('HTTP Server not available in Cloudflare Pages runtime');
                    }
                  };
                  export class IncomingMessage {
                    constructor() {
                      throw new Error('IncomingMessage not available in Cloudflare Pages runtime');
                    }
                  };
                  export class ServerResponse {
                    constructor() {
                      throw new Error('ServerResponse not available in Cloudflare Pages runtime');
                    }
                  };
                  export const createServer = () => {
                    throw new Error('createServer not available in Cloudflare Pages runtime');
                  };
                  export default {
                    Server,
                    IncomingMessage,
                    ServerResponse,
                    createServer,
                  };
                `;
              }
              if (moduleName === 'os') {
                return `
                  // Polyfill for node:os in Cloudflare Pages
                  // Cloudflare Pages doesn't have OS-level access
                  export const tmpdir = () => '/tmp';
                  export const homedir = () => '/';
                  export const platform = () => 'cloudflare';
                  export const arch = () => 'wasm32';
                  export const cpus = () => [];
                  export const totalmem = () => 0;
                  export const freemem = () => 0;
                  export const hostname = () => 'cloudflare';
                  export const type = () => 'Cloudflare';
                  export const release = () => '';
                  export const uptime = () => 0;
                  export const loadavg = () => [0, 0, 0];
                  export const networkInterfaces = () => ({});
                  export const userInfo = () => ({
                    username: 'cloudflare',
                    uid: 0,
                    gid: 0,
                    shell: null,
                    homedir: '/',
                  });
                  export const endianness = () => 'LE';
                  export const EOL = '\\n';
                  export default {
                    tmpdir,
                    homedir,
                    platform,
                    arch,
                    cpus,
                    totalmem,
                    freemem,
                    hostname,
                    type,
                    release,
                    uptime,
                    loadavg,
                    networkInterfaces,
                    userInfo,
                    endianness,
                    EOL,
                  };
                `;
              }
              if (moduleName === 'stream') {
                return `
                  // Polyfill for node:stream in Cloudflare Pages
                  // Minimal stream implementations
                  export class Readable {
                    constructor() {
                      throw new Error('Streams not fully supported in Cloudflare Pages');
                    }
                  };
                  export class Writable {
                    constructor() {
                      throw new Error('Streams not fully supported in Cloudflare Pages');
                    }
                  };
                  export class Transform {
                    constructor() {
                      throw new Error('Streams not fully supported in Cloudflare Pages');
                    }
                  };
                  export class Duplex {
                    constructor() {
                      throw new Error('Streams not fully supported in Cloudflare Pages');
                    }
                  };
                  export const pipeline = async () => {
                    throw new Error('Pipeline not supported in Cloudflare Pages');
                  };
                  export default {
                    Readable,
                    Writable,
                    Transform,
                    Duplex,
                    pipeline,
                  };
                `;
              }
              if (moduleName === 'events') {
                return `
                  // Polyfill for node:events in Cloudflare Pages
                  // Use EventTarget as base for EventEmitter
                  export class EventEmitter {
                    constructor() {
                      this._events = {};
                      this._maxListeners = 10;
                    }
                    on(event, listener) {
                      if (!this._events[event]) this._events[event] = [];
                      this._events[event].push(listener);
                      return this;
                    }
                    once(event, listener) {
                      const onceWrapper = (...args) => {
                        listener(...args);
                        this.off(event, onceWrapper);
                      };
                      return this.on(event, onceWrapper);
                    }
                    off(event, listener) {
                      if (!this._events[event]) return this;
                      this._events[event] = this._events[event].filter(l => l !== listener);
                      return this;
                    }
                    emit(event, ...args) {
                      if (!this._events[event]) return false;
                      this._events[event].forEach(listener => listener(...args));
                      return true;
                    }
                    removeListener(event, listener) {
                      return this.off(event, listener);
                    }
                    removeAllListeners(event) {
                      if (event) {
                        delete this._events[event];
                      } else {
                        this._events = {};
                      }
                      return this;
                    }
                    setMaxListeners(n) {
                      this._maxListeners = n;
                      return this;
                    }
                    getMaxListeners() {
                      return this._maxListeners;
                    }
                    listeners(event) {
                      return this._events[event] || [];
                    }
                    listenerCount(event) {
                      return this._events[event] ? this._events[event].length : 0;
                    }
                  }
                  export default EventEmitter;
                `;
              }
              if (moduleName === 'process') {
                return `
                  // Polyfill for node:process in Cloudflare Pages
                  export const env = globalThis.process?.env || {};
                  export const version = 'v18.0.0';
                  export const versions = {};
                  export const platform = 'cloudflare';
                  export const arch = 'wasm32';
                  export const pid = 1;
                  export const ppid = 0;
                  export const cwd = () => '/';
                  export const chdir = () => {
                    throw new Error('chdir not supported in Cloudflare Pages');
                  };
                  export const exit = (code) => {
                    throw new Error('exit not supported in Cloudflare Pages');
                  };
                  export const nextTick = (fn) => {
                    Promise.resolve().then(fn);
                  };
                  export const uptime = () => 0;
                  export const hrtime = () => [0, 0];
                  export const memoryUsage = () => ({
                    rss: 0,
                    heapTotal: 0,
                    heapUsed: 0,
                    external: 0,
                    arrayBuffers: 0,
                  });
                  export default {
                    env,
                    version,
                    versions,
                    platform,
                    arch,
                    pid,
                    ppid,
                    cwd,
                    chdir,
                    exit,
                    nextTick,
                    uptime,
                    hrtime,
                    memoryUsage,
                  };
                `;
              }
              if (moduleName === 'net') {
                return `
                  // Polyfill for node:net in Cloudflare Pages
                  export class Socket {
                    constructor() {
                      throw new Error('Net sockets not available in Cloudflare Pages');
                    }
                  };
                  export class Server {
                    constructor() {
                      throw new Error('Net server not available in Cloudflare Pages');
                    }
                  };
                  export const createConnection = () => {
                    throw new Error('createConnection not available in Cloudflare Pages');
                  };
                  export const createServer = () => {
                    throw new Error('createServer not available in Cloudflare Pages');
                  };
                  export default {
                    Socket,
                    Server,
                    createConnection,
                    createServer,
                  };
                `;
              }
              if (moduleName === 'tls') {
                return `
                  // Polyfill for node:tls in Cloudflare Pages
                  export class TLSSocket {
                    constructor() {
                      throw new Error('TLS sockets not available in Cloudflare Pages');
                    }
                  };
                  export const createSecureContext = () => {
                    throw new Error('createSecureContext not available in Cloudflare Pages');
                  };
                  export default {
                    TLSSocket,
                    createSecureContext,
                  };
                `;
              }
              if (moduleName === 'dns') {
                return `
                  // Polyfill for node:dns in Cloudflare Pages
                  export const lookup = async () => {
                    throw new Error('DNS lookup not available in Cloudflare Pages');
                  };
                  export const resolve = async () => {
                    throw new Error('DNS resolve not available in Cloudflare Pages');
                  };
                  export default {
                    lookup,
                    resolve,
                  };
                `;
              }
              if (moduleName === 'zlib') {
                return `
                  // Polyfill for node:zlib in Cloudflare Pages
                  // Use CompressionStream API if available
                  export const gzip = async (data) => {
                    const stream = new CompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    writer.write(data);
                    writer.close();
                    const chunks = [];
                    let done = false;
                    while (!done) {
                      const { value, done: d } = await reader.read();
                      done = d;
                      if (value) chunks.push(value);
                    }
                    return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                  };
                  export const gunzip = async (data) => {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    writer.write(data);
                    writer.close();
                    const chunks = [];
                    let done = false;
                    while (!done) {
                      const { value, done: d } = await reader.read();
                      done = d;
                      if (value) chunks.push(value);
                    }
                    return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                  };
                  export const deflate = async (data) => {
                    const stream = new CompressionStream('deflate');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    writer.write(data);
                    writer.close();
                    const chunks = [];
                    let done = false;
                    while (!done) {
                      const { value, done: d } = await reader.read();
                      done = d;
                      if (value) chunks.push(value);
                    }
                    return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                  };
                  export const inflate = async (data) => {
                    const stream = new DecompressionStream('deflate');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    writer.write(data);
                    writer.close();
                    const chunks = [];
                    let done = false;
                    while (!done) {
                      const { value, done: d } = await reader.read();
                      done = d;
                      if (value) chunks.push(value);
                    }
                    return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                  };
                  export default {
                    gzip,
                    gunzip,
                    deflate,
                    inflate,
                  };
                `;
              }
              if (moduleName === 'child_process') {
                return `
                  // Polyfill for node:child_process in Cloudflare Pages
                  export const spawn = () => {
                    throw new Error('Child process not available in Cloudflare Pages');
                  };
                  export const exec = () => {
                    throw new Error('Child process not available in Cloudflare Pages');
                  };
                  export const execFile = () => {
                    throw new Error('Child process not available in Cloudflare Pages');
                  };
                  export const fork = () => {
                    throw new Error('Child process not available in Cloudflare Pages');
                  };
                  export default {
                    spawn,
                    exec,
                    execFile,
                    fork,
                  };
                `;
              }
              if (moduleName === 'cluster') {
                return `
                  // Polyfill for node:cluster in Cloudflare Pages
                  export const isMaster = false;
                  export const isPrimary = false;
                  export const fork = () => {
                    throw new Error('Cluster not available in Cloudflare Pages');
                  };
                  export default {
                    isMaster,
                    isPrimary,
                    fork,
                  };
                `;
              }
              if (moduleName === 'perf_hooks') {
                return `
                  // Polyfill for node:perf_hooks in Cloudflare Pages
                  export const performance = globalThis.performance;
                  export const PerformanceObserver = globalThis.PerformanceObserver;
                  export default {
                    performance,
                    PerformanceObserver,
                  };
                `;
              }
              if (moduleName === 'querystring') {
                return `
                  // Polyfill for node:querystring in Cloudflare Pages
                  export const parse = (str) => {
                    const params = new URLSearchParams(str);
                    const obj = {};
                    for (const [key, value] of params) {
                      obj[key] = value;
                    }
                    return obj;
                  };
                  export const stringify = (obj) => {
                    const params = new URLSearchParams();
                    for (const [key, value] of Object.entries(obj)) {
                      params.append(key, String(value));
                    }
                    return params.toString();
                  };
                  export const escape = encodeURIComponent;
                  export const unescape = decodeURIComponent;
                  export default {
                    parse,
                    stringify,
                    escape,
                    unescape,
                  };
                `;
              }
              if (moduleName === 'string_decoder') {
                return `
                  // Polyfill for node:string_decoder in Cloudflare Pages
                  export class StringDecoder {
                    constructor(encoding = 'utf8') {
                      this.encoding = encoding;
                    }
                    write(buffer) {
                      return new TextDecoder(this.encoding).decode(buffer);
                    }
                    end(buffer) {
                      return buffer ? this.write(buffer) : '';
                    }
                  }
                  export default StringDecoder;
                `;
              }
              if (moduleName === 'timers') {
                return `
                  // Polyfill for node:timers in Cloudflare Pages
                  export const setTimeout = globalThis.setTimeout;
                  export const clearTimeout = globalThis.clearTimeout;
                  export const setInterval = globalThis.setInterval;
                  export const clearInterval = globalThis.clearInterval;
                  export const setImmediate = (fn, ...args) => {
                    return setTimeout(() => fn(...args), 0);
                  };
                  export const clearImmediate = clearTimeout;
                  export default {
                    setTimeout,
                    clearTimeout,
                    setInterval,
                    clearInterval,
                    setImmediate,
                    clearImmediate,
                  };
                `;
              }
              if (moduleName === 'tty') {
                return `
                  // Polyfill for node:tty in Cloudflare Pages
                  export const isatty = () => false;
                  export class ReadStream {
                    constructor() {
                      throw new Error('TTY ReadStream not available in Cloudflare Pages');
                    }
                  }
                  export class WriteStream {
                    constructor() {
                      throw new Error('TTY WriteStream not available in Cloudflare Pages');
                    }
                  }
                  export default {
                    isatty,
                    ReadStream,
                    WriteStream,
                  };
                `;
              }
              if (moduleName === 'vm') {
                return `
                  // Polyfill for node:vm in Cloudflare Pages
                  export const createContext = () => ({});
                  export const runInContext = () => {
                    throw new Error('VM not available in Cloudflare Pages');
                  };
                  export const runInNewContext = () => {
                    throw new Error('VM not available in Cloudflare Pages');
                  };
                  export const runInThisContext = () => {
                    throw new Error('VM not available in Cloudflare Pages');
                  };
                  export default {
                    createContext,
                    runInContext,
                    runInNewContext,
                    runInThisContext,
                  };
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
          resolveId(id) {
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
