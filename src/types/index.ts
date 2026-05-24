/**
 * 核心数据模型与类型接口定义
 * 定义音乐播放器应用中使用的所有核心类型
 */

/** 音源平台类型 */
export type MusicSource = 'netease' | 'qq';

/** 播放模式枚举 */
export enum PlayMode {
  /** 顺序播放 */
  Sequential = 'sequential',
  /** 随机播放 */
  Shuffle = 'shuffle',
  /** 单曲循环 */
  RepeatOne = 'repeat-one',
}

/** 单首音乐曲目 */
export interface Track {
  /** 曲目唯一标识 */
  id: string;
  /** 曲目标题 */
  title: string;
  /** 艺术家名称 */
  artist: string;
  /** 专辑名称 */
  album: string;
  /** 时长（秒） */
  duration: number;
  /** 封面图片 URL */
  coverUrl: string;
  /** 音源平台 */
  source: MusicSource;
}

/** 歌单 */
export interface Playlist {
  /** 歌单唯一标识 */
  id: string;
  /** 歌单名称 */
  name: string;
  /** 歌单中的曲目列表 */
  tracks: Track[];
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 更新时间戳（毫秒） */
  updatedAt: number;
}

/** 播放状态 */
export interface PlaybackState {
  /** 当前播放的曲目 */
  currentTrack: Track | null;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 曲目总时长（秒） */
  duration: number;
  /** 音量（0-100） */
  volume: number;
  /** 播放模式 */
  playMode: PlayMode;
}

/** 用户数据（持久化存储） */
export interface UserData {
  /** 用户歌单列表 */
  playlists: Playlist[];
  /** 收藏的曲目列表 */
  favorites: Track[];
  /** 搜索历史记录 */
  searchHistory: string[];
  /** 播放状态 */
  playbackState: PlaybackState;
}

/** 搜索结果 */
export interface SearchResult {
  /** 搜索到的曲目列表 */
  tracks: Track[];
  /** 结果总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 是否还有更多结果 */
  hasMore: boolean;
}

/** 歌词行 */
export interface LyricLine {
  /** 时间戳（秒） */
  time: number;
  /** 歌词文本 */
  text: string;
  /** 该行持续时间（秒） */
  duration?: number;
}

/** 统一音质等级 */
export enum AudioQuality {
  /** 标准 128kbps */
  Standard = 'standard',
  /** 高品质 320kbps */
  High = 'high',
  /** 无损 FLAC */
  Lossless = 'lossless',
  /** Hi-Res */
  HiRes = 'hires',
}

/** 音质等级显示名称 */
export const QUALITY_LABELS: Record<AudioQuality, string> = {
  [AudioQuality.Standard]: '标准',
  [AudioQuality.High]: '高品质',
  [AudioQuality.Lossless]: '无损',
  [AudioQuality.HiRes]: 'Hi-Res',
}

/** 深色主题配置 */
export interface ThemeConfig {
  /** 主色调 */
  primaryColor: string;
  /** 主背景色 */
  backgroundColor: string;
  /** 卡片/面板背景色 */
  surfaceColor: string;
  /** 主文字色 */
  textColor: string;
  /** 次要文字色 */
  textSecondaryColor: string;
  /** 强调色 */
  accentColor: string;
}
