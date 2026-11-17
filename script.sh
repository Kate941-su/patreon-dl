#!/bin/bash
# 互換用: npm run download と同じ（4. ダウンロードのみ）
cd "$(dirname "$0")"
npx tsx download.ts "$@"
