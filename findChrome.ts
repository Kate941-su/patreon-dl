// OS ごとに Chrome（または Chromium）の実行ファイルを探す
// 環境変数 CHROME_PATH があればそれを最優先で使う
import * as fs from 'fs';
import * as path from 'path';

function candidates(): string[] {
  switch (process.platform) {
    case 'darwin':
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(process.env.HOME ?? '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
    case 'win32': {
      const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA];
      return roots
        .filter((r): r is string => !!r)
        .map((r) => path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    default: {
      // Linux など: PATH 上のコマンド名から探す
      const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
      const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
      return names.flatMap((n) => dirs.map((d) => path.join(d, n)));
    }
  }
}

export function findChrome(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) throw new Error(`CHROME_PATH に指定されたファイルがありません: ${fromEnv}`);
    return fromEnv;
  }
  const found = candidates().find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'Google Chrome が見つかりません。インストールするか、環境変数 CHROME_PATH に実行ファイルのパスを指定してください。'
    );
  }
  return found;
}
