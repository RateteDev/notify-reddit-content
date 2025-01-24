import axios from 'axios';
import * as TOML from '@iarna/toml';
import { WebhookClient } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import logger from './logger.js';  // .jsを追加
import { SYSTEM_PROMPT, USER_PROMPT } from './system_prompt.js';  // プロンプトをインポート

// 設定ファイルの型定義
interface Config {
  reddit: {
    subreddit: string;
    post_limit: number;
    comment_depth: number;
    time_range: 'day' | 'week' | 'month' | 'year' | 'all';  // Redditの時間範囲
  };
  llm: {
    use_provider: string;
    deepseek: {
      api_key: string;
    };
  };
  notification: {
    discord: {
      webhook_url: string;
    };
  };
}

// Redditの投稿データの型定義
interface RedditPost {
  kind: string;  // 投稿種別（t3 = 投稿）
  data: {
    // 基本情報
    id: string;
    title: string;
    selftext: string | null;
    url: string;
    permalink: string;
    author: string;
    created_utc: number;

    // エンゲージメント情報
    score: number;
    num_comments: number;
    upvote_ratio: number;

    // メタ情報
    link_flair_text: string | null;
    is_self: boolean;
    domain: string;
  };
  comments?: string[];  // 取得したコメント
}

// 要約用のJSON型定義
interface PostSummaryInput {
  id: string;
  content: string;
}

interface SummaryResponse {
  original: PostSummaryInput[];
  summary: string;
  timestamp: string;
}

// データ保存クラス
class DataStore {
  saveData(directory: string, filename: string, data: any): void {
    const path = join(directory, filename);
    try {
      writeFileSync(path, JSON.stringify(data, null, 2));
      logger.info('DataStore', `データを保存しました: ${path}`);
    } catch (error) {
      logger.error('DataStore', `データの保存に失敗しました: ${path}`, error);
      throw error;
    }
  }
}

// Reddit APIクライアントクラス
class RedditClient {
  private readonly dataStore: DataStore;
  private readonly subreddit: string;
  private readonly postLimit: number;
  private readonly commentDepth: number;
  private readonly timeRange: Config['reddit']['time_range'];

  constructor(config: Config['reddit'], dataStore: DataStore) {
    this.dataStore = dataStore;
    this.subreddit = config.subreddit;
    this.postLimit = config.post_limit;
    this.commentDepth = config.comment_depth;
    this.timeRange = config.time_range;
  }

  async fetchPosts(): Promise<RedditPost[]> {
    logger.info('RedditClient', `Redditの投稿を取得します: ${this.subreddit}, limit: ${this.postLimit}, depth: ${this.commentDepth}, time_range: ${this.timeRange}`);
    
    const url = `https://www.reddit.com/r/${this.subreddit}/top.json?t=${this.timeRange}&limit=${this.postLimit}`;
    const response = await axios.get(url, { headers: { 'User-Agent': 'RedditNotifier/1.0.0' } });
    const posts = response.data.data.children as RedditPost[];

    // コメントを取得
    for (const post of posts) {
      const postId = post.data.id;
      const commentsUrl = `https://www.reddit.com/r/${this.subreddit}/comments/${postId}.json?depth=${this.commentDepth}`;
      const commentsResponse = await axios.get(commentsUrl, { headers: { 'User-Agent': 'RedditNotifier/1.0' } });
      post.comments = commentsResponse.data[1].data.children
        .filter((comment: any) => comment.kind === 't1' && comment.data?.body)
        .map((comment: any) => comment.data.body);
    }

    // 投稿データを保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.dataStore.saveData('data/reddit', `posts_${timestamp}.json`, posts);

    return posts;
  }

  formatPost(post: RedditPost): string {
    const timestamp = new Date(post.data.created_utc * 1000).toLocaleString('ja-JP');
    const content = [
      `タイトル: ${post.data.title}`,
      `投稿者: ${post.data.author}`,
      `投稿日時: ${timestamp}`,
      post.data.is_self 
        ? `本文: ${post.data.selftext ?? '(本文なし)'}` 
        : `リンク: ${post.data.url} (${post.data.domain})`,
      `スコア: ${post.data.score} (${Math.round(post.data.upvote_ratio * 100)}% upvoted)`,
      `コメント数: ${post.data.num_comments}`,
      post.data.link_flair_text ? `フレアー: ${post.data.link_flair_text}` : null,
      `URL: https://reddit.com${post.data.permalink}`,
      post.comments && post.comments.length > 0 ? '\nトップコメント:' : null,
      ...(post.comments || []).slice(0, 3).map(comment => `> ${comment}`)
    ].filter(Boolean).join('\n');

    return content;
  }
}

// DeepSeek APIクライアントクラス
class DeepSeekClient {
  private readonly apiKey: string;
  private readonly dataStore: DataStore;
  private readonly client: OpenAI;

  constructor(apiKey: string, dataStore: DataStore) {
    this.apiKey = apiKey;
    this.dataStore = dataStore;
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey,
    });
  }

  async summarizePosts(posts: PostSummaryInput[]): Promise<string> {
    logger.info('DeepSeekClient', `DeepSeek APIで${posts.length}件の投稿を要約します`);
    try {
      const completion = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: USER_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(posts, null, 2),
          }
        ],
      });

      const summary = completion.choices[0].message.content;
      if (!summary) {
        throw new Error('要約の生成に失敗しました');
      }

      // 要約データを保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const summaryResponse: SummaryResponse = {
        original: posts,
        summary: summary,
        timestamp: timestamp
      };
      this.dataStore.saveData('data/summaries', `summary_${timestamp}.json`, summaryResponse);

      return summary;
    } catch (error) {
      logger.error('DeepSeekClient', 'DeepSeek API error:', error);
      throw error;
    }
  }
}

// Discord通知クラス
class DiscordNotifier {
  private readonly webhook: WebhookClient;
  private readonly MAX_MESSAGE_LENGTH = 1900;

  constructor(webhookUrl: string) {
    this.webhook = new WebhookClient({ url: webhookUrl });
  }

  private splitMessage(content: string): string[] {
    // Markdownの見出しLv3（###）で分割
    const sections = content.split(/(?=### )/);
    
    // 空のセクションを除外
    return sections.filter(section => section.trim().length > 0);
  }

  async notify(content: string, options: { useCodeBlock?: boolean } = {}): Promise<void> {
    logger.info('DiscordNotifier', 'Discordに通知を送信します');
    
    const messages = this.splitMessage(content);
    logger.info('DiscordNotifier', `${messages.length}個の投稿を送信します`);

    for (const [index, message] of messages.entries()) {
      if (message.length > this.MAX_MESSAGE_LENGTH) {
        const chunks = message.match(new RegExp(`.{1,${this.MAX_MESSAGE_LENGTH}}`, 'g')) || [];
        for (const chunk of chunks) {
          const formattedChunk = options.useCodeBlock ? `\`\`\`md\n${chunk}\n\`\`\`` : chunk;
          await this.webhook.send(formattedChunk);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        const formattedMessage = options.useCodeBlock ? `\`\`\`md\n${message}\n\`\`\`` : message;
        await this.webhook.send(formattedMessage);
      }
      logger.info('DiscordNotifier', `投稿 ${index + 1}/${messages.length} を送信しました`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('DiscordNotifier', 'Discord通知が完了しました');
  }
}

// メインの通知処理クラス
class RedditContentNotifier {
  private readonly dataStore: DataStore;
  private readonly redditClient: RedditClient;
  private readonly deepSeekClient: DeepSeekClient;
  private readonly discordNotifier: DiscordNotifier;

  constructor() {
    const config = this.loadConfig();
    this.dataStore = new DataStore();
    this.redditClient = new RedditClient(config.reddit, this.dataStore);
    this.deepSeekClient = new DeepSeekClient(config.llm.deepseek.api_key, this.dataStore);
    this.discordNotifier = new DiscordNotifier(config.notification.discord.webhook_url);
  }

  private loadConfig(): Config {
    const configFile = readFileSync('./config.toml', 'utf-8');
    return TOML.parse(configFile) as unknown as Config;
  }

  public async run(): Promise<void> {
    logger.info('RedditContentNotifier', 'プログラムを開始します');
    try {
      const posts = await this.redditClient.fetchPosts();
      const formattedPosts: PostSummaryInput[] = posts.map(post => ({
        id: post.data.id,
        content: this.redditClient.formatPost(post)
      }));
      const summary = await this.deepSeekClient.summarizePosts(formattedPosts);
      await this.discordNotifier.notify(summary);
      logger.info('RedditContentNotifier', '処理が完了しました');
    } catch (error) {
      logger.error('RedditContentNotifier', 'エラーが発生しました:', error);
      throw error;
    }
  }
}

// プログラムを実行
const notifier = new RedditContentNotifier();
notifier.run().catch(error => {
  console.error('プログラムが異常終了しました:', error);
  process.exit(1);
}); 