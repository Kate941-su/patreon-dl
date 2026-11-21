// 4. urls.txt の投稿を cookies.txt のログイン状態で一括ダウンロードする
// 保存先: yyyy/mm/dd/タイトル [id].拡張子 / archive.txt でダウンロード済みはスキップ
// 使い方: npm run download                              … ./urls.txt を ./ に保存
//         npm run download -- "collections/<コレクション名>" … そのフォルダの urls.txt をそのフォルダに保存
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const COOKIE_FILE = 'cookies.txt';
const OUTPUT = '%(upload_date>%Y)s/%(upload_date>%m)s/%(upload_date>%d)s/%(title)s [%(id)s].%(ext)s';

export function download(dir = '.') {
  const URL_LIST = path.join(dir, 'urls.txt');
  const ARCHIVE_FILE = path.join(dir, 'archive.txt'); // フォルダごとにダウンロード済みを記録する
  for (const f of [COOKIE_FILE, URL_LIST]) {
    if (!fs.existsSync(f)) throw new Error(`${f} がありません。先に npm run urls を実行してください。`);
  }

  const urls = fs
    .readFileSync(URL_LIST, 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let failed = 0;
  for (const url of urls) {
    console.log(`Downloading: ${url}`);
    const result = spawnSync(
      'yt-dlp',
      // YouTube の JS チャレンジ解読に Node.js を使う（yt-dlp は uv tool install "yt-dlp[default]" で入れる）
      ['--js-runtimes', 'node', '--cookies', COOKIE_FILE, '--download-archive', ARCHIVE_FILE, '--output', path.join(dir, OUTPUT), url],
      { stdio: 'inherit' }
    );
    if (result.error) {
      throw new Error(`yt-dlp を起動できません。インストールして PATH に通してください。(${result.error.message})`);
    }
    if (result.status !== 0) failed++; // 1件失敗しても残りは続ける
  }
  console.log(`完了: ${urls.length} 件中 ${failed} 件失敗`);
}

if (require.main === module) {
  try {
    download(process.argv[2]);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
