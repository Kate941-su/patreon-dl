// 1〜4 をまとめて実行する
// 使い方: npm start -- "https://www.patreon.com/<クリエイター名>/posts"
//         npm start -- "https://www.patreon.com/<クリエイター名>/posts" --tag <タグ名>
//         npm start -- "https://www.patreon.com/collection/<コレクションID>"
import { getUrls, parseArgs, usage } from './getUrls';
import { download } from './download';

let targetUrl: string | undefined;
try {
  targetUrl = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
if (!targetUrl) {
  console.error(usage.replace(/npm run urls/g, 'npm start'));
  process.exit(1);
}

getUrls(targetUrl)
  .then((dir) => download(dir))
  .then(
    () => process.exit(0),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  );
