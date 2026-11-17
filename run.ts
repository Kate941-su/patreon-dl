// 1〜4 をまとめて実行する
// 使い方: npm start -- "https://www.patreon.com/<クリエイター名>/posts"
//         npm start -- "https://www.patreon.com/collection/<コレクションID>"
import { getUrls, usage } from './getUrls';
import { download } from './download';

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error(usage);
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
