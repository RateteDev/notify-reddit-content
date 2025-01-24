# Notify Reddit Content 🤖

![Project Banner](assets/images/banner.jpg)

Redditの投稿を自動で要約してDiscordに通知するBotアプリケーションです。

## 特徴 ✨

- Reddit APIを使用して指定したサブレディットの投稿を取得
- DeepSeek APIを使用して投稿内容を要約
- Discordウェブフックを通じて通知を送信
- TypeScript + Bunで高速な実行
- TOMLベースの設定管理

## 必要要件 📋

- [Bun](https://bun.sh/) 1.0.0以上
- Discord Webhookの設定
- DeepSeek API Key

## インストール 🚀

```bash
# レポジトリのクローン
git clone https://github.com/RateteDev/notify-reddit-content.git
cd notify-reddit-content

# 依存関係のインストール
bun install
```

## 設定 ⚙️

1. `config.toml.example`を`config.toml`にコピー
2. 以下の設定を行う：
   - Redditの取得設定
   - DeepSeek API Key
   - Discord Webhook URL

```toml
[reddit]
subreddit = "your_subreddit"
post_limit = 5
comment_depth = 3
time_range = "week"

[llm.deepseek]
api_key = "your_api_key"

[notification.discord]
webhook_url = "your_webhook_url"
```

## 使用方法 💡

```bash
# 開発モード（ホットリロード）
bun dev

# 本番実行
bun start
```

## ライセンス 📄

GPL-3.0 © RateteDev 