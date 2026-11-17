#!/bin/bash
# 互換用: npm start と同じ（1〜4 をまとめて実行）
# 使い方: bash run.sh "https://www.patreon.com/<クリエイター名>/posts"
set -e
cd "$(dirname "$0")"
npx tsx run.ts "$1"
