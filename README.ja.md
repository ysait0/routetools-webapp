# routetools-webapp

[English README is here](README.md)

ルートファイル（GPX / KML / KMZ / TCX / FIT）の形式変換、POI追加・編集をブラウザ上で行うSPAです。Garmin、Wahoo、Bryton、Pioneer などのサイクリングGPSデバイス向けファイルを扱えます。

CLI版 [routetools-cli](https://github.com/ysait0/routetools-cli) のブラウザ版です。インストール不要・アカウント登録不要で、ファイルは端末外に送信されません（すべてブラウザ内で処理）。

## 機能

- ルートファイル（GPX / KML / KMZ / TCX / FIT）の読み込みと地図上でのプレビュー
- 別のルートファイルやCSVからのPOI追加
- 地図上でルートをクリックしてPOIを手動追加
- POIの名前・説明・タイプ（Generic / Flag / Straight / Left / Right）の編集
- POIを常にルート進行順で表示
- スタート / ゴール POI の一括追加
- 右左折POIの自動追加と削除
- 逆走の切り替え（地図・POI一覧・標高プロファイルへ即時反映）
- 標高プロファイルの表示とルート上 / プロファイル上のクロスハイライト
- 地図上のボタンから現在の表示範囲で Google Maps の周辺施設検索を開く
- Undo / Redo（ボタンおよび `Ctrl/Cmd+Z` / `Ctrl+Y` / `Cmd+Shift+Z`）
- 許容距離（tolerance）と Force（最近傍点スナップ）の調整
- TCX または GPX 形式でダウンロード
- 日本語・英語 UI 切り替え

## 対応形式

- 入力: `GPX / KML / KMZ / TCX / FIT`
- POI追加入力: `GPX / KML / KMZ / TCX / FIT / CSV`
- 出力: `TCX / GPX`

## 使い方

ブラウザで以下のページを開くだけです:

**<https://ysait0.github.io/routetools-webapp/>**

1. 「ルートファイル」エリアにルートファイルをドロップ（またはクリックで選択）
2. 必要に応じて「POI追加」エリアに別ファイルや CSV をドロップ、または地図上のルートをクリックしてPOIを追加
3. POI一覧やマーカーのポップアップで、名前・説明・タイプを編集
4. 必要に応じて、スタート/ゴール追加、右左折POI自動追加、逆走切り替えを行う
5. 地図右上の 🔍 ボタンで Google Maps を開き、カフェやコンビニなどの周辺施設を確認できる
6. 標高プロファイルで全体像を確認しながら、出力形式（TCX / GPX）・許容距離・Force を設定
7. 「ダウンロード」をクリック

## POIインポート用のCSVフォーマット

```csv
(緯度),(経度),(名前),(説明),(タイプ)
```

| フィールド | 必須 |
| :--------- | :--: |
| 緯度       |  ○  |
| 経度       |  ○  |
| 名前       |  ○  |
| 説明       |  ○  |
| タイプ     |  －  |

例:

```csv
35.68249921156559,139.77653207620816,PC1,セブンイレブン日本橋１丁目昭和通り店
35.54219882219259,139.76194900229007,通過チェック1,多摩川スカイブリッジ,Generic
```

## ローカルで動かす

静的サイトなので、任意の静的ファイルサーバで動作します:

```bash
cd routetools-webapp
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## セキュリティ

- ファイルはすべてブラウザ内で処理され、外部サーバーには送信されません
- CDNリソース（Leaflet / JSZip）には SRI（Subresource Integrity）ハッシュを付与
- Content Security Policy（CSP）でスクリプト・画像・接続先を制限
- iframe 埋め込みを禁止（`frame-ancestors 'none'`）
- 入力ファイルサイズ制限（50MB）および KMZ 展開サイズ制限（100MB）

## 技術スタック

- Vanilla JavaScript（フレームワーク・ビルドステップなし）
- [Leaflet](https://leafletjs.com/) （地図表示）
- [JSZip](https://stuk.github.io/jszip/) （KMZ展開）
- [fit-file-parser](https://www.npmjs.com/package/fit-file-parser) （FIT読込。ブラウザでは動的importで利用）
- OpenStreetMap / CyclOSM / 国土地理院タイル

## 関連リポジトリ

- [routetools-cli](https://github.com/ysait0/routetools-cli) — 同じ機能を持つCLI版

## ライセンス

MIT License. [LICENSE](LICENSE) を参照してください。
