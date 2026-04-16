# routetools-webapp

[English README is here](README.md)

ルートファイル（GPX / KML / KMZ / TCX）の編集・POI追加をブラウザ上で行うSPAです。Garmin、Wahoo、Bryton、Pioneer などのサイクリングGPSデバイス向けファイルを扱えます。

CLI版 [routetools-cli](https://github.com/ysait0/routetools-cli) のブラウザ版です。インストール不要・アカウント登録不要で、ファイルは端末外に送信されません（すべてブラウザ内で処理）。

## 機能

- ルートファイル（GPX / KML / KMZ / TCX）の読み込みと地図上でのプレビュー
- 別のルートファイルやCSVからのPOI追加
- 地図上でルートをクリックしてPOIを手動追加
- POIの名前・説明・タイプ（Generic / Flag / Straight / Left / Right）のインライン編集
- 許容距離（tolerance）と Force（最近傍点スナップ）の調整
- TCX または GPX 形式でダウンロード
- 日本語・英語 UI 切り替え

## 使い方

ブラウザで以下のページを開くだけです:

**<https://ysait0.github.io/routetools-webapp/>**

1. 「ルートファイル」エリアにルートファイルをドロップ（またはクリックで選択）
2. （任意）「POI追加」エリアに別のルートファイルや CSV をドロップ、または地図上のルートをクリックして手動追加
3. POI一覧で名前・説明・タイプをインライン編集
4. 出力形式（TCX / GPX）・許容距離・Force を設定
5. 「ダウンロード」をクリック

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

## 技術スタック

- Vanilla JavaScript（フレームワーク・ビルドステップなし）
- [Leaflet](https://leafletjs.com/) （地図表示）
- [JSZip](https://stuk.github.io/jszip/) （KMZ展開）
- OpenStreetMap タイル

## 関連リポジトリ

- [routetools-cli](https://github.com/ysait0/routetools-cli) — 同じ機能を持つCLI版

## ライセンス

MIT License. [LICENSE](LICENSE) を参照してください。
