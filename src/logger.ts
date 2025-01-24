import winston from 'winston';
import chalk from 'chalk';

// ログレベルの型定義
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// ログレベルごとの色設定
const colorize = {
  error: (text: string) => chalk.red(text),
  warn: (text: string) => chalk.yellow(text),
  info: (text: string) => chalk.green(text),
  debug: (text: string) => chalk.gray(text)
} as const;

// シンプルなロガーの作成
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, context }) => {
      // 時間を水色に
      const coloredTime = chalk.cyan(timestamp);
      // ログレベルに色付け
      const coloredLevel = colorize[level as LogLevel]?.(level.toUpperCase()) || chalk.white(level.toUpperCase());
      // コンテキストは白で
      const contextStr = context ? chalk.white(`[${context}]`) : '';
      
      return `${coloredTime} ${coloredLevel} ${contextStr} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    // ファイルには色なしで出力
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: winston.format.uncolorize() 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: winston.format.uncolorize() 
    })
  ]
});

// ユーティリティ関数
export function log(context: string, level: LogLevel, message: string, ...args: any[]) {
  logger.log(level, message, { context, ...args });
}

// 便利なラッパー関数
export const info = (context: string, message: string, ...args: any[]) => log(context, 'info', message, ...args);
export const error = (context: string, message: string, ...args: any[]) => log(context, 'error', message, ...args);
export const warn = (context: string, message: string, ...args: any[]) => log(context, 'warn', message, ...args);
export const debug = (context: string, message: string, ...args: any[]) => log(context, 'debug', message, ...args);

export default {
  info,
  error,
  warn,
  debug
}; 