/**
 * SearchService - 搜索服务
 * 提供关键词搜索、分页加载、搜索建议和搜索历史管理功能
 * 搜索历史持久化到本地存储
 */

import type { SearchResult } from '../types/index';
import type { MusicAPIAdapter } from './music-api-adapter';
import { storageService } from './ipc-renderer';

/** 搜索历史存储键名 */
const SEARCH_HISTORY_KEY = 'searchHistory';

/** 搜索历史最大条数 */
const MAX_HISTORY_SIZE = 20;

/** 默认每页数量 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * 搜索服务类
 * 封装搜索逻辑，管理搜索历史
 */
export class SearchService {
  private history: string[] = [];
  private adapter: MusicAPIAdapter;

  constructor(adapter: MusicAPIAdapter) {
    this.adapter = adapter;
    this.loadHistory();
  }

  setAdapter(adapter: MusicAPIAdapter): void {
    this.adapter = adapter;
  }

  /**
   * 从本地存储加载搜索历史
   */
  private async loadHistory(): Promise<void> {
    try {
      this.history = await storageService.load<string[]>(SEARCH_HISTORY_KEY, []);
    } catch {
      this.history = [];
    }
  }

  /**
   * 搜索音乐
   * @param keyword 搜索关键词
   * @param page 页码（从 1 开始），默认为 1
   * @returns 搜索结果
   */
  async search(keyword: string, page: number = 1): Promise<SearchResult> {
    return this.adapter.search(keyword, page, DEFAULT_PAGE_SIZE);
  }

  /**
   * 获取搜索建议
   * @param keyword 搜索关键词
   * @returns 搜索建议列表
   */
  async getSuggestions(keyword: string): Promise<string[]> {
    return this.adapter.getSearchSuggestions(keyword);
  }

  /**
   * 获取搜索历史
   * @returns 搜索历史数组（最近的在前）
   */
  getSearchHistory(): string[] {
    return this.history;
  }

  /**
   * 添加关键词到搜索历史
   * - 去重：如果已存在则移到最前面
   * - 最多保留 MAX_HISTORY_SIZE 条记录
   * - 持久化到本地存储
   * @param keyword 搜索关键词
   */
  addToHistory(keyword: string): void {
    if (!keyword.trim()) return;

    const trimmed = keyword.trim();

    // 去重：移除已存在的相同关键词
    this.history = this.history.filter((item) => item !== trimmed);

    // 添加到最前面
    this.history.unshift(trimmed);

    // 限制最大条数
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, MAX_HISTORY_SIZE);
    }

    // 持久化
    this.persistHistory();
  }

  /**
   * 清空搜索历史
   */
  clearHistory(): void {
    this.history = [];
    this.persistHistory();
  }

  /**
   * 持久化搜索历史到本地存储
   */
  private persistHistory(): void {
    storageService.save(SEARCH_HISTORY_KEY, this.history);
  }
}
