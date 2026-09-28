// =============================================================
// script.json (templates/script.schema.json) の型定義と
// タイムライン計算。文言・タイミングはすべて script.json 側で管理する
// =============================================================

export const FPS = 30;

export const COLORS = {
  background: '#F7F2E8', // 生成りのクリーム色
  text: '#6B5B4A', // 焦げ茶
};

export type Cut = {
  slug: string;
  telop: string;
  h3_prompt: string;
  input_image: string;
  seed: number;
  duration_sec: number;
  dialogue?: string;
  telop_start_sec?: number;
};

export type EpisodeScript = {
  title: string;
  episode_slug: string;
  resolution?: {aspect_ratio?: string; megapixels?: number};
  cuts: Cut[];
  render: {
    crossfade_sec: number;
    final_fadeout_sec: number;
    // square: 1080x1080を中央配置し上下420pxはクリーム余白(既定)
    // fullbleed: 9:16素材を画面いっぱいに表示し、テロップは映像上にオーバーレイ
    layout?: 'square' | 'fullbleed';
    telop?: {duration_sec?: number; font_size?: number};
    title?: {
      enabled?: boolean;
      text?: string;
      duration_sec?: number;
      font_size?: number;
    };
  };
};

export const TELOP_DEFAULTS = {
  duration_sec: 2.5,
  font_size: 64,
  fadeInFrames: 12,
  fontWeight: '500' as const,
};

export const TITLE_DEFAULTS = {
  enabled: true,
  duration_sec: 2,
  font_size: 44,
  fadeInFrames: 15,
  fontWeight: '500' as const,
};

// MiniMax H3 の実フレーム数(24fps): max(5, round(sec*24)) を「17で割って5余る」数に切り上げ
// (comfyui雛形の ComfyMathExpression と同じ式)
export const h3FrameCount = (durationSec: number): number => {
  const base = Math.max(5, Math.round(durationSec * 24));
  return base + ((5 - (base % 17)) % 17 + 17) % 17;
};

// カットのRemotion上の尺(30fps)。切り上げによる末尾のフレーム凍結を
// 避けるため切り捨てる(10秒指定 → 10.125秒 → 303フレーム)
export const clipDurationInFrames = (cut: Cut): number =>
  Math.floor((h3FrameCount(cut.duration_sec) / 24) * FPS);

export const crossfadeInFrames = (script: EpisodeScript): number =>
  Math.round(script.render.crossfade_sec * FPS);

export const finalFadeInFrames = (script: EpisodeScript): number =>
  Math.round(script.render.final_fadeout_sec * FPS);

// 各カットはクロスフェード分だけ重ねて配置する(カット尺は可変)
export const cutStartFrame = (script: EpisodeScript, index: number): number => {
  const xf = crossfadeInFrames(script);
  let start = 0;
  for (let i = 0; i < index; i++) {
    start += clipDurationInFrames(script.cuts[i]) - xf;
  }
  return start;
};

export const totalDurationInFrames = (script: EpisodeScript): number =>
  cutStartFrame(script, script.cuts.length - 1) +
  clipDurationInFrames(script.cuts[script.cuts.length - 1]);

// テロップ表示開始フレーム。省略時: 先頭カットは0、以降はクロスフェード明け
export const telopStartInFrames = (
  script: EpisodeScript,
  index: number,
): number => {
  const cut = script.cuts[index];
  if (cut.telop_start_sec != null) return Math.round(cut.telop_start_sec * FPS);
  return index === 0 ? 0 : crossfadeInFrames(script);
};

// N番目(1始まり)のカットの素材ファイル(publicDir=エピソードフォルダ からの相対)
export const cutAssetPath = (cut: Cut, index: number): string =>
  `assets/cut${index + 1}_${cut.slug}.mp4`;
