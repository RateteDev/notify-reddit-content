# ソースコード構造

`src`ディレクトリには以下のファイルが含まれています：

## ファイル構成

```
src/
├── index.ts       # メインのアプリケーションロジック
├── logger.ts      # ログ管理モジュール
└── system_prompt.ts # LLMのプロンプト定義
```

## 各ファイルの説明

### index.ts

メインのアプリケーションエントリーポイントです。以下の主要なクラスを含みます：

- `DataStore`: JSONデータの保存を管理
- `RedditClient`: Redditからのデータ取得とフォーマット
- `DeepSeekClient`: DeepSeek APIを使用した要約生成
- `DiscordNotifier`: Discord Webhookを通じた通知送信
- `RedditContentNotifier`: 上記のクラスを統合した主要なアプリケーションロジック

### logger.ts

Winstonを使用したログ管理モジュールです。以下の機能を提供：

- 複数のログレベル（info, warn, error）
- ファイルとコンソールへのログ出力
- 日付とログレベルに基づいたフォーマット
- エラーのスタックトレース保存

### system_prompt.ts

DeepSeek APIに送信するプロンプトの定義を含みます：

- `SYSTEM_PROMPT`: LLMのシステムプロンプト
- `USER_PROMPT`: 要約生成用のユーザープロンプト

## 主要なデータフロー

1. `index.ts`がアプリケーションを起動
2. `RedditClient`がReddit APIからデータを取得
3. 取得したデータを`DeepSeekClient`で要約
4. 要約結果を`DiscordNotifier`で通知
5. 全てのプロセスで`logger.ts`がログを記録

## 設定と依存関係

- 設定は`config.toml`で管理
- 外部APIキーとWebhook URLが必要
- TypeScriptとBunランタイムを使用 