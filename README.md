# Web OCR

日本語 | [English](README.en.md)

画像をドラッグ＆ドロップするだけで、日本語の文字起こしができる Web アプリケーションです。読み取った結果はその場で編集できます。

![Web OCR のデモ](docs/demo.gif)

## クイックスタート

```bash
git clone https://github.com/kec4411/web-ocr.git
cd web-ocr && docker compose up
```

ブラウザで <http://localhost:5173> を開いてください。必要なものは Docker だけです。Node.js も Python も Tesseract もホストには不要です。

動作確認用のサンプル画像を [`docs/samples/`](docs/samples) に同梱しています（名刺・レシート、いずれも架空データ）。

## 技術スタック

| | |
|---|---|
| フロントエンド | React 18 / TypeScript / Vite / Chakra UI v2 |
| バックエンド | Python 3.12 / FastAPI / pytesseract |
| OCR エンジン | Tesseract 5.5 (LSTM) + 日本語学習データ (縦書き対応) |
| 実行環境 | Docker Compose |
| テスト | pytest (7件) / Vitest + Testing Library (5件) |

## アーキテクチャ

```mermaid
flowchart LR
    B["ブラウザ<br/>React + Chakra UI"]
    F["frontend<br/>Vite dev server :5173"]
    A["backend<br/>FastAPI :9004"]
    T["Tesseract 5.5<br/>jpn + eng"]

    B -->|"画像をドロップ"| F
    B -->|"POST /convert/<br/>multipart"| A
    A -->|"PIL Image"| T
    T -->|"認識テキスト"| A
    A -->|"{ text: ... }"| B
```

## 機能

- 画像のドラッグ＆ドロップ、またはファイル選択によるアップロード
- 日本語と英語の混在テキストの認識（`jpn+eng`）
- アップロード前のプレビュー表示
- 読み取り結果はその場で編集でき、行数に応じてテキストエリアが自動で広がる
- 形式・サイズの検証（画像のみ、10MB まで）とエラーの明示

## このリポジトリについて

3年前に開発したアプリケーションを、ポートフォリオとして提出できる状態に再構築したものです。コミット履歴は「当時のコードをそのまま取り込む」→「段階的に現代化する」という実際の作業順に並んでいます。

着手時点で、**このアプリは動作しませんでした。**

| | 着手前 | 現在 |
|---|---|---|
| バックエンドのビルド | **不可能**（28秒で失敗） | 成功 |
| 日本語 OCR | **一度も動いていなかった** | 動作 |
| `git clone` | 608MB | **1.5MB** |
| 追跡ファイル数 | 45,438 | **32** |
| テスト | `npm test` が失敗、バックエンドは0件 | pytest 7件 / Vitest 5件 |

> 個々の技術判断とその理由は [設計メモ](docs/design-notes.md) にまとめています。

## 開発

```bash
# 起動
#   初回ビルド: 約27秒（ベースイメージ取得済みの場合。未取得ならその分加算）
#   2回目以降:  約7秒
docker compose up

# バックエンドのテスト
docker compose exec backend pip install -r requirements-dev.txt
docker compose exec backend python -m pytest

# フロントエンドのテスト・型チェック
cd frontend
npm install
npm test
npm run typecheck

# 本番ビルド（nginx 配信、http://localhost:8080）
docker compose --profile prod up frontend-prod
```

### 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `OCR_LANG` | `jpn+eng` | Tesseract の言語。日本語文書には数字や型番が混ざるため既定で英語を併用 |
| `OCR_PSM` | `3` | ページ分割モード。3 = 自動（Tesseract の既定） |
| `MAX_UPLOAD_BYTES` | `10485760` | アップロード上限（10MB） |
| `CORS_ALLOW_ORIGINS` | `http://localhost:5173,http://localhost:8080` | 許可するオリジン（カンマ区切り）。5173 = Vite、8080 = nginx (prod) |
| `VITE_API_BASE_URL` | `http://localhost:9004` | フロントから見た API の場所 |

> **注意:** Vite は `VITE_*` を**ビルド時**にインライン展開します。開発サーバーでは compose の `environment:` で届きますが、**本番イメージでは build arg として渡す必要があります**（`frontend/Dockerfile` の `ARG VITE_API_BASE_URL`）。実行時の環境変数はバンドルに届きません。

## トラブルシューティング

### `package.json` を変更したのに依存が反映されない

`node_modules` は名前付きボリュームに載せています。ボリュームは初回作成時にイメージから展開された後は永続するため、再ビルドしても古いボリュームが新しい依存を覆い隠します。

```bash
docker compose down -v && docker compose up --build
```

### `OCR_LANG` を変えたらコンテナが起動しない

意図した挙動です。起動時チェックが言語パックの有無を検証し、不足していればコンテナが**起動時に**落ちます（初回アップロード時ではなく）。

```
RuntimeError: Tesseract 5.5.0 is missing language pack(s): ['klingon'].
Installed: ['eng', 'jpn', 'jpn_vert', 'osd']
```

必要な言語パックを `backend/Dockerfile` の `apt-get install` に追加してください。

## 既知の制約

- OCR 精度は入力画像の品質に依存します。傾き補正や二値化などの前処理は行っていません
- PDF は非対応（画像のみ）
- 読み取り結果の保存機能はありません。ページを離れると結果は失われます
- 認証はありません。ローカル開発用の構成です

## ライセンス

MIT
