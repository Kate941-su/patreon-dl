# patoreon-dl

自分が支援している Patreon クリエイターの投稿動画を一括ダウンロードするツールです。

1. Chrome を開いてログインする
2. Cookie を `cookies.txt` に保存する
3. 投稿 URL を `urls.txt` に保存する
4. `yt-dlp` で一括ダウンロードする

## 必要なもの

macOS / Linux / Windows で動きます。

- Google Chrome（Linux では Chromium も可）
- Node.js
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)（`yt-dlp` コマンドが PATH から実行できること）

Chrome は次の場所から自動で探します。見つからないときは環境変数 `CHROME_PATH` に実行ファイルのパスを指定してください。

| OS | 探す場所 |
|---|---|
| macOS | `/Applications/Google Chrome.app`、`~/Applications/Google Chrome.app`、`/Applications/Chromium.app` |
| Linux | PATH 上の `google-chrome` / `google-chrome-stable` / `chromium` / `chromium-browser` |
| Windows | `Program Files`、`Program Files (x86)`、`%LOCALAPPDATA%` の下の `Google\Chrome\Application\chrome.exe` |

```bash
# 例: 自動で見つからない場合
CHROME_PATH=/opt/google/chrome/chrome npm start -- "https://www.patreon.com/<クリエイター名>/posts"
```

Windows（PowerShell）の場合は `$env:CHROME_PATH="C:\path\to\chrome.exe"` を先に実行します。

## セットアップ

```bash
npm install
```

## 使い方

### まとめて実行（1〜4）

```bash
npm start -- "https://www.patreon.com/<クリエイター名>/posts"
```

1. Chrome が開きます。Patreon にログインしてください（Google ログインも使えます）。
   YouTube の動画を埋め込んだ投稿がある場合は、別のタブで https://www.youtube.com にもログインしてください（初回のみ）。
2. 投稿一覧ページが表示されたら、ターミナルで **Enter** を押します。
3. 自動でスクロールして投稿 URL を集め、そのままダウンロードが始まります。

ログイン状態は `chrome-profile/` に保存されるので、2回目以降は Chrome が開いたらすぐ Enter を押すだけです。

### 個別に実行

```bash
# 1〜3: ログイン、Cookie と URL の取得
npm run urls -- "https://www.patreon.com/<クリエイター名>/posts"

# 4: ダウンロードのみ（中断後の再開もこれ）
npm run download
```

以前の `bash run.sh` / `bash script.sh` も macOS・Linux ではそのまま使えます。

### コレクションごとにダウンロード

コレクションの URL を渡すと、そのコレクションの投稿だけをダウンロードします。

```bash
npm start -- "https://www.patreon.com/collection/<コレクションID>"
```

コレクション名のフォルダに分けて保存し、`urls.txt` と `archive.txt` もコレクションごとに作ります。

```
collections/
└── <コレクション名>/
    ├── urls.txt
    ├── archive.txt
    └── 2026/10/09/タイトル [ID].mp4
```

続きからダウンロードし直すときは、フォルダを指定します。

```bash
npm run download -- "collections/<コレクション名>"
```

> 投稿一覧（`/posts`）とは別に記録するので、すでに投稿一覧でダウンロードした動画もコレクションのフォルダにもう一度保存されます。

### タグで絞り込んでダウンロード

`--tag` でタグ名を指定すると、そのタグの付いた投稿だけをダウンロードします。

```bash
npm start -- "https://www.patreon.com/<クリエイター名>/posts" --tag インサイドキャンピング
```

Patreon で絞り込んだ URL（`.../posts?filters%5Btag%5D=...`）をそのまま渡しても同じです。
`tags/<タグ名>/` に保存し、`urls.txt` と `archive.txt` もタグごとに作ります。続きからダウンロードし直すときは次のとおりです。

```bash
npm run download -- "tags/<タグ名>"
```

## 保存先

投稿日ごとのフォルダに保存されます。

```
2026/
└── 11/
    └── 12/
        └── タイトル [投稿ID].mp4
```

ダウンロード済みの動画は `archive.txt` に記録され、次回はスキップされます。

## 生成されるファイル

| ファイル | 内容 |
|---|---|
| `chrome-profile/` | ログイン状態を保持する専用の Chrome プロフィール |
| `cookies.txt` | yt-dlp 用の Cookie |
| `urls.txt` | 投稿 URL の一覧（`https://www.patreon.com/posts/<ID>` 形式） |
| `collections/<名前>/` | コレクションごとの `urls.txt`・`archive.txt`・動画 |
| `tags/<タグ名>/` | タグごとの `urls.txt`・`archive.txt`・動画 |
| `archive.txt` | ダウンロード済みの投稿 ID |

> **注意:** `chrome-profile/` と `cookies.txt` にはログイン情報が含まれます。他人に渡したり、Git にコミットしたりしないでください。

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `Chrome did not open debug port 9222` | ポート 9222 を使っている別の Chrome が起動していないか確認する |
| URL が 0 件になる | 投稿一覧ページを開いた状態で Enter を押しているか確認する |
| `You do not have access to this post` | ログインしているか、その投稿にアクセスできるプランに加入しているか確認する。もう一度 `npm run urls` を実行して Cookie を取り直す |
| Google ログインで「This browser may not be secure」と出る | Patreon のメールアドレスとパスワードでログインする |
| `Sign in to confirm you're not a bot` | YouTube 埋め込みの投稿で、YouTube にロボットと疑われています。開いた Chrome で YouTube にログインし、もう一度 `npm run urls` を実行して Cookie を取り直す（実行時に「YouTube にログインしていません」と出ないことを確認）。メインの Google アカウントを使いたくない場合はサブアカウントでも可 |
| `Google Chrome が見つかりません` | Chrome をインストールするか、`CHROME_PATH` を指定する |
| `yt-dlp を起動できません` | yt-dlp をインストールし、PATH に通す |
| 別の PC にコピーしたらログインが切れている | `chrome-profile/` は OS をまたいで使えません。もう一度 `npm run urls` でログインし直す |
| Linux サーバーなど画面がない環境で使いたい | 画面のある PC で `npm run urls` を実行し、`cookies.txt` と `urls.txt` をサーバーにコピーして `npm run download` だけ実行する |
| Ubuntu の snap 版 Chromium で起動しない | Google 配布の Chrome（.deb）を入れるか、`CHROME_PATH` で別の Chrome を指定する |
