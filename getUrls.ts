// 1. Chrome を開いてログイン → 2. Cookie を cookies.txt に保存 → 3. 投稿URLを urls.txt に保存
// 使い方: npm run urls -- "https://www.patreon.com/<クリエイター名>/posts"
import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { findChrome } from './findChrome';

const DEBUG_PORT = 9222;
const PROFILE_DIR = path.resolve('chrome-profile'); // ログイン状態を保持する専用プロフィール

// 例: https://www.patreon.com/<クリエイター名>/posts/some-title-123456789
//     https://www.patreon.com/posts/some-title-123456789
// 末尾の数字が投稿ID。yt-dlp が確実に扱えるよう https://www.patreon.com/posts/<ID> に正規化する。
const POST_URL = /^https:\/\/(?:www\.)?patreon\.com\/(?:[\w.-]+\/)?posts\/(?:[\w%-]*-)?(\d+)$/;

async function waitForDebugPort(port: number, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return;
    } catch {
      // まだ起動中
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Chrome did not open debug port ${port} within ${timeoutMs}ms`);
}

function waitForEnter(message: string) {
  console.log(message);
  return new Promise((resolve) => process.stdin.once('data', resolve));
}

// yt-dlp が読める Netscape 形式で Cookie を書き出す
async function saveCookies(context: BrowserContext, filePath: string) {
  // YouTube 埋め込みの投稿は yt-dlp が YouTube から取得するため、YouTube の Cookie も書き出す
  // （ログインしていないと「Sign in to confirm you're not a bot」で止まる）
  const isTarget = (domain: string) => /(^|\.)(patreon\.com|youtube\.com)$/.test(domain);
  const cookies = (await context.cookies()).filter((c) => isTarget(c.domain));
  const youtubeLoggedIn = cookies.some((c) => c.domain.endsWith('youtube.com') && c.name === 'SAPISID');
  if (!youtubeLoggedIn) {
    console.warn(
      '注意: YouTube にログインしていません。YouTube 埋め込みの投稿は「not a bot」エラーで失敗することがあります。\n' +
        '      開いた Chrome で https://www.youtube.com にログインしてから、もう一度実行してください。'
    );
  }
  const lines = cookies.map((c) =>
    [
      c.domain,
      c.domain.startsWith('.') ? 'TRUE' : 'FALSE',
      c.path,
      c.secure ? 'TRUE' : 'FALSE',
      c.expires > 0 ? Math.floor(c.expires) : 0,
      c.name,
      c.value,
    ].join('\t')
  );
  fs.writeFileSync(filePath, ['# Netscape HTTP Cookie File', ...lines, ''].join('\n'), {
    encoding: 'utf-8',
    mode: 0o600, // ログイン情報なので自分だけ読めるようにする
  });
  console.log(`Cookie を ${cookies.length} 件 ${filePath} に保存しました`);
}

export const usage =
  '使い方: npm run urls -- "https://www.patreon.com/<クリエイター名>/posts"\n' +
  '        npm run urls -- "https://www.patreon.com/collection/<コレクションID>"\n' +
  '        npm run urls -- "https://www.patreon.com/<クリエイター名>/posts" --tag <タグ名>';

/**
 * コマンドライン引数から対象 URL を作る。
 * --tag <タグ名>（または --tag=<タグ名>）があれば投稿一覧 URL に ?filters[tag]=<タグ名> を付ける。
 */
export function parseArgs(argv: string[]): string | undefined {
  let url: string | undefined;
  let tag: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tag' || a === '-t') tag = argv[++i];
    else if (a.startsWith('--tag=')) tag = a.slice('--tag='.length);
    else if (!url) url = a;
  }
  if (!url) return undefined;
  if (tag === undefined) return url;
  if (!tag) throw new Error('--tag にタグ名を指定してください');
  const u = new URL(url);
  if (COLLECTION_URL.test(u.href)) throw new Error('--tag は投稿一覧の URL と一緒に使ってください');
  if (!u.pathname.includes('/posts')) u.pathname = u.pathname.replace(/\/?$/, '/posts');
  u.searchParams.set('filters[tag]', tag);
  return u.href;
}

const COLLECTION_URL = /^https:\/\/(?:www\.)?patreon\.com\/collection\/(\d+)/;

// 投稿一覧のタグ絞り込み (?filters[tag]=<タグ名>) のタグ名を取り出す
function tagFilterOf(url: string) {
  try {
    return new URL(url).searchParams.get('filters[tag]') || undefined;
  } catch {
    return undefined;
  }
}

// フォルダ名に使えない文字を置き換える（Windows でも使える名前にする）
function safeDirName(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim();
}

// 投稿一覧ページをスクロール／「もっと見る」を押して全投稿の ID を集める
async function collectFromPostsPage(page: Page, creatorPostsUrl: string) {
  // 投稿一覧以外にいる、またはタグの絞り込みが違うときは指定の URL を開き直す
  if (!page.url().includes('/posts') || tagFilterOf(page.url()) !== tagFilterOf(creatorPostsUrl)) {
    await page.goto(creatorPostsUrl, { waitUntil: 'domcontentloaded' });
  }
  console.log('投稿を読み込み中...');
  const collect = () =>
    page.$$eval('a[href*="/posts/"]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));

  let idle = 0;
  let lastCount = 0;
  let ids = new Set<string>();
  while (idle < 3) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const loadMore = page
      .getByRole('button', { name: /^(load more|see more|show more|もっと見る|さらに表示|もっと読み込む)/i })
      .first();
    if (await loadMore.isVisible().catch(() => false)) await loadMore.click().catch(() => {});
    await page.waitForTimeout(2500);

    ids = new Set(
      (await collect())
        .map((href) => href.split(/[?#]/)[0].match(POST_URL)?.[1])
        .filter((id): id is string => !!id)
    );
    if (ids.size === lastCount) {
      idle++;
      console.log(`新しい投稿なし (${idle}/3)`);
    } else {
      idle = 0;
      lastCount = ids.size;
      console.log(`${ids.size} 件取得中...`);
    }
  }
  return [...ids];
}

// コレクションの投稿 ID とタイトルを Patreon の API から取得する（ログイン中のブラウザで fetch する）
async function collectFromCollection(page: Page, collectionId: string) {
  const res = await page.evaluate(async (id) => {
    const r = await fetch(`/api/collection/${id}`, { credentials: 'include' });
    return { status: r.status, body: r.ok ? await r.json() : null };
  }, collectionId);
  if (!res.body) throw new Error(`コレクション ${collectionId} を取得できませんでした (HTTP ${res.status})`);
  const attrs = res.body.data.attributes as { title?: string; post_ids?: number[] };
  const title = safeDirName(attrs.title ?? '') || `collection-${collectionId}`;
  const ids = (attrs.post_ids ?? []).map(String);
  console.log(`コレクション「${attrs.title}」: ${ids.length} 件`);
  return { title, ids };
}

/**
 * ログインして Cookie と投稿 URL を保存する。
 * 戻り値はダウンロード先フォルダ（投稿一覧なら "."、コレクションなら "collections/<名前>"、タグ絞り込みなら "tags/<タグ名>"）。
 */
export async function getUrls(targetUrl: string): Promise<string> {
  const collectionId = targetUrl.match(COLLECTION_URL)?.[1];
  const tag = collectionId ? undefined : tagFilterOf(targetUrl);

  // Playwright が起動したブラウザだと Google ログインが「This browser may not be secure」で弾かれるため、
  // 通常の Chrome を起動し、Playwright は CDP 経由で接続するだけにする。
  const chrome = spawn(
    findChrome(),
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    { stdio: 'ignore' }
  );

  try {
    await waitForDebugPort(DEBUG_PORT);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());

    // 1. ログイン
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await waitForEnter(
      `---\n開いた Chrome で Patreon にログインし、${collectionId ? 'コレクション' : '投稿一覧'}ページが表示されたらこのターミナルで Enter を押してください\n` +
        '（YouTube 埋め込みの動画もある場合は、別タブで https://www.youtube.com にもログインしておいてください）\n---'
    );

    // 2. Cookie 保存
    await saveCookies(context, 'cookies.txt');

    // 3. 投稿 ID を集める
    let outDir = '.';
    let ids: string[];
    if (collectionId) {
      if (!page.url().startsWith('https://www.patreon.com/')) await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      const col = await collectFromCollection(page, collectionId);
      ids = col.ids;
      outDir = path.join('collections', col.title);
    } else {
      ids = await collectFromPostsPage(page, targetUrl);
      if (tag) {
        outDir = path.join('tags', safeDirName(tag) || 'tag');
        console.log(`タグ「${tag}」: ${ids.length} 件`);
      }
    }

    const urls = ids.map((id) => `https://www.patreon.com/posts/${id}`);
    fs.mkdirSync(outDir, { recursive: true });
    const urlFile = path.join(outDir, 'urls.txt');
    fs.writeFileSync(urlFile, urls.join('\n') + '\n', 'utf-8');
    console.log(`投稿URLを ${urls.length} 件 ${urlFile} に保存しました`);

    await browser.close(); // CDP 接続を切断
    return outDir;
  } finally {
    chrome.kill();
  }
}

if (require.main === module) {
  let targetUrl: string | undefined;
  try {
    targetUrl = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  if (!targetUrl) {
    console.error(usage);
    process.exit(1);
  }
  getUrls(targetUrl).then(
    () => process.exit(0),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  );
}
