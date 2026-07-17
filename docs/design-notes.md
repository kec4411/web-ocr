# 設計上の判断

[Web OCR](../README.md) の開発で実際に迷い、根拠をもって選んだ技術判断の記録です。

### 1. 「重かった」原因は計測するまで誤解していた

当初は「ホストの `node_modules`（518MB / 45,340ファイル）がバインドマウントで VM 境界を越えるからフロントエンドが遅い」と考えていました。**実測でこの仮説は否定されました。**

- ウォーム: 17秒
- コールド（webpack キャッシュ 174MB を退避）: 10秒

webpack は実際に `import` されたモジュールしか読まないため、518MB の存在はほとんど効いていませんでした。フロントエンドはボトルネックではなかったのです。

真因はバックエンドでした。ビルドは28秒でこう落ちます。

```
Cannot find a valid baseurl for repo: base/7/x86_64
failed to solve: process "/bin/sh -c yum update -y" did not complete successfully
```

CentOS 7 は 2024年6月に EOL を迎えミラーが停止しています。`x86_64` という表示が示すとおり、arm64 Mac 上で amd64 イメージを QEMU エミュレーションしていました。3年前はミラーが生きていたので、`yum update` が数百パッケージを引き、OpenCV が Python 3.6 用 wheel を持たずソースビルドに落ち、**その全てがエミュレーション下で走っていました**。これが数十分の正体です。

この経験から、**推測で最適化せず、まず計測する**という原則を実践しました。仮説が外れていたため、各施策の正当化を書き直しています（下記）。

### 2. OpenCV は「更新」ではなく「削除」した

`cv2` の使用箇所は jpg→png 変換の2行だけでしたが、**その変換自体が不要**でした。

- Tesseract は Leptonica 経由で JPEG を直接読める
- PIL も JPEG を直接扱え、しかも既に import 済みだった
- pytesseract は内部で PIL 画像を一時ファイルに書き出してから tesseract に渡す

つまり二重の手間をかけて、OCR 結果に影響しない形式変換をしていました。削除により約220MB（イメージ 667MB → 447MB）が減り、加えて**以下のバグが「修正」ではなく「消滅」しました**。

- 削除済みファイルのパスを返す TOCTOU（`create_temppath`）
- `except` なしの `try/finally` による一時ファイル漏れ
- `finally` 内の2度目の `FileNotFoundError` が `HTTPException` を握り潰す
- `.JPG` / `.JPEG`（大文字）が変換分岐を素通りする

**バグは直すより、原因となるコードを消せるなら消す方が良い**という判断です。

### 3. pyocr → pytesseract（人気度が理由ではない）

日本語 OCR は一度も動いていませんでした。原因はこれです。

```python
langs = tool.get_available_languages()  # ['eng', 'jpn', 'jpn_vert', 'osd']
lang = langs[0]                         # -> 'eng'
```

`get_available_languages()` はソート済みリストを返すため、`langs[0]` は常に `'eng'` です。Dockerfile はわざわざ日本語パックを入れ、UI も全て日本語なのに、バックエンドは英語モードに固定されていました。同じ画像での実測結果です。

| | 出力 |
|---|---|
| 修正前 | `CNETAKHRTS.` / `BARBOCRO BF HER.` / `Web OCR 20264F ABC123` |
| 修正後 | `これはテスト画像です。` / `日本語OCRの動作確認。` / `Web OCR 2026年 ABC123` |

移行の理由は「pytesseract の方が人気だから」ではありません。**この2大バグ（`langs[0]` と `tools[0]` の `IndexError`）が pyocr の API 形状の産物だから**です。順序付きリストを渡してインデックスアクセスを誘う API だからこうなります。pytesseract には言語リストが無く `lang='jpn+eng'` を明示的に渡すため、**バグのクラスごと存在しなくなります**。

### 4. 副次的だが大きい効果：Tesseract 3.04 → 5.5

CentOS 7 の EPEL が配布していたのは Tesseract **3.04**（レガシーのパターンマッチエンジン）でした。`python:3.12-slim` は **5.5**（LSTM エンジン）です。日本語において LSTM は限界的改善ではなく別品質帯であり、この移行は「イメージが軽くなる」だけでなく**アプリの中核機能そのものを改善**しています。

### 5. node_modules の遮断には2つの機構が両方必要

これは速度ではなく**正しさ**の問題でした。従来のフロント Dockerfile は実質2行のスタブで `npm install` すらせず、依存を全てホストからバインドマウントしていました。つまり **macOS 用にビルドされたバイナリを Linux コンテナ内で実行していた**わけです。

名前付きボリューム導入後の実測です。

| | ネイティブバイナリ |
|---|---|
| コンテナ内 | `@rolldown/binding-linux-arm64-musl` |
| ホスト | `@rolldown/binding-darwin-arm64` |

必要な機構は2つあり、**どちらか片方でも欠けると darwin バイナリが Linux コンテナに戻ります**。

- `.dockerignore` — `COPY . .` がホストの `node_modules` をイメージに焼き込むのを防ぐ
- 名前付きボリューム — バインドマウントがイメージ内の `/app/node_modules` を上書き（shadow）するのを防ぐ

### 6. マルチステージはフロントだけ（バックエンドは単一ステージ）

非対称にしたのは意図的です。判断基準は「builder ステージが捨てるものが実在するか」です。

- **フロントエンド**: prod ステージが `node_modules` を捨て nginx で静的配信する。**545MB → 92.4MB** の実益がある
- **バックエンド**: 依存が全て pure Python か aarch64 wheel を持ち、**コンパイラツールチェーンを一切入れない**。捨てるものが無いのでマルチステージは0MB削減。`--no-cache-dir` と `rm -rf /var/lib/apt/lists/*` で十分

「マルチステージは常に善」というパターンマッチではなく、**効果が実在する場所にだけ適用**しました。

### 7. Chakra UI は v2 のまま（v3 に上げない）

- v3 は Ark UI ベースの全面書き直しで、`ChakraProvider` も `theme` エクスポートも消滅する
- **`Editable` 系（このアプリの中核）が v3 で最も API 変更の大きいコンポーネント群**であり、移行リスクが本体に集中する
- ポートフォリオとしての価値がゼロな一方、移行がプロジェクトを食い潰し肝心のバグが未修正で終わるリスクが実在した

`^2.4.9` → `^2.10.10` に留めています。React も **18.3.1 に固定**（Chakra v2 は React 19 で既知の問題あり）。

### 8. TypeScript がバグ修正を機械的に強制した

型移行は履歴書映えのためではありません。`strict` に加えて **`noUncheckedIndexedAccess`** を有効にすると、コンパイラが次を指摘します。

- `acceptedFiles[0]` が `File | undefined` になる → 文字列 `"undefined"` をバックエンドに送っていたバグ
- `<Editable value={ocrText}>` の `ocrText: string | undefined` が型エラー → 欠落した `onChange` と未定義初期値

### 9. テストは「このバグが実際に起きたから、これがある」

カバレッジを追わず、実際に発生したバグを守る12件に絞りました。最も価値が高いのは `test_japanese_langpack_installed` で、`{'jpn','eng'} <= set(pytesseract.get_languages())` を検証するだけの高速なテストですが、上記の言語バグを直接守ります。

回帰テストとして機能することも確認済みです。`Editable` から `onChange` を外すと、`lets the user edit the OCR result` **だけ**が的確に落ちます。

### 10. git 履歴は作り直した

着手時、追跡ファイル 45,438 件の **99.94%（45,410件）が `node_modules`** でした。最大の blob は webpack の開発キャッシュ（65.8MB と 36.5MB の `.pack` ファイル）で、依存ですらない一時生成物です。履歴中の `node_modules` 以外の全内容は **1.35MB** しかありませんでした。

`git-filter-repo` は「本物の履歴を保ちつつ特定パスだけを外科的に除去する」ためのツールですが、履歴は「initial commit」1件のみで、保存する価値のあるものがありません。そのため `rm -rf .git && git init` を選び、**元のコードを先にコミットしてから現代化を積む**構成にしました。作業の実際の順序と一致し、コミットログ自体が記録として読めます。

結果: `.git` 88MB → **約1.5MB**、`git clone` 608MB → **1.5MB**。
