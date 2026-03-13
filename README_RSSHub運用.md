# RSSHub 運用メモ

## 概要

- 自前の RSSHub は Vercel で運用（例: https://rss-hub-five-gray.vercel.app）
- 本リポジトリは Fork（megumiya-ooura/RSSHub）を `tools/RSSHub` で管理
- 新着記事など、RSS がないサイト用にカスタムルートを追加して RSS 化する

---

## 新規サイトを RSS 化するときの流れ

1. **ルート追加**  
   `lib/v2/{名前空間}/` に router.js とルート用 js（Cheerio 等）を追加する。
2. **Fork に反映**  
   変更をコミットし、Fork の `legacy` ブランチに push（GitHub Desktop または `git push myfork legacy`）。
3. **Vercel**  
   Production が最新コミットでデプロイされているか確認。必要なら Promote to Production。
4. **RSS URL の形**  
   `https://rss-hub-five-gray.vercel.app/{名前空間}/{パス}`  
   例: `/forbesjapan/latest` → `https://rss-hub-five-gray.vercel.app/forbesjapan/latest`
5. **情報収集システム**  
   「RSS管理」シートに上記 URL を 1 行追加（clientId・ソース名等は既存フォーマットに合わせる）。

---

## 今後「この URL を RSS 化してほしい」ときのプロンプト例

依頼するときは、次のような文言で **手順やスキルを確認したうえで** RSS 化してほしいと指定するとよい。

- **例文（そのまま使ってよい）**  
  「この URL を、RSSHub のルート追加手順（または既存の RSSHub スキル/ドキュメント）を確認して、RSS 化された URL を作成してください。」

- **もう少し具体的にしたい場合**  
  「次の URL を RSS 化したいです。`tools/RSSHub` の運用メモと既存ルート（例: lib/v2/forbesjapan）を確認し、RSSHub のルートを追加して、RSS 化された URL を出してください。URL: [ここに対象URL]」
