import {loadFont} from '@remotion/google-fonts/ZenMaruGothic';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {
  COLORS,
  Cut,
  EpisodeScript,
  TELOP_DEFAULTS,
  TITLE_DEFAULTS,
  clipDurationInFrames,
  crossfadeInFrames,
  cutAssetPath,
  cutStartFrame,
  finalFadeInFrames,
  telopStartInFrames,
  totalDurationInFrames,
} from './script';

const {fontFamily} = loadFont('normal', {
  weights: ['500', '700'],
  subsets: ['japanese'],
});

const clampVolume = (v: number) => Math.max(0, Math.min(1, v));

// 全体フェードアウト(音声用)。絶対フレームを渡す
const globalFadeAt = (script: EpisodeScript, absoluteFrame: number) => {
  const total = totalDurationInFrames(script);
  return interpolate(
    absoluteFrame,
    [total - finalFadeInFrames(script), total],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
};

const Clip = ({
  script,
  cut,
  index,
}: {
  script: EpisodeScript;
  cut: Cut;
  index: number;
}) => {
  const frame = useCurrentFrame();
  const isFirst = index === 0;
  const isLast = index === script.cuts.length - 1;
  const startFrame = cutStartFrame(script, index);
  const clipFrames = clipDurationInFrames(cut);
  const xf = crossfadeInFrames(script);
  const telop = {...TELOP_DEFAULTS, ...script.render.telop};
  const telopDurationInFrames = Math.round(
    (telop.duration_sec ?? TELOP_DEFAULTS.duration_sec) * 30,
  );
  const telopStart = telopStartInFrames(script, index);

  // 後のカットが上に重なり、クロスフェード区間で不透明度0→1にする。
  // 下のカットは終端までそのまま表示され続けるので視覚的なフェードアウトは不要
  const fadeInOpacity = isFirst
    ? 1
    : interpolate(frame, [0, xf], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const volume = (f: number) => {
    const fadeIn = isFirst
      ? 1
      : interpolate(f, [0, xf], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
    const fadeOut = isLast
      ? 1
      : interpolate(f, [clipFrames - xf, clipFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
    return clampVolume(fadeIn * fadeOut * globalFadeAt(script, startFrame + f));
  };

  const telopOpacity = interpolate(
    frame,
    [
      telopStart,
      telopStart + telop.fadeInFrames,
      telopStart + telopDurationInFrames - telop.fadeInFrames,
      telopStart + telopDurationInFrames,
    ],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const fullbleed = script.render.layout === 'fullbleed';

  return (
    <AbsoluteFill style={{opacity: fadeInOpacity}}>
      {/* square: 1080x1080 を中央配置(上下420px余白) / fullbleed: 画面いっぱい */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <OffthreadVideo
          src={staticFile(cutAssetPath(cut, index))}
          volume={volume}
          style={
            fullbleed
              ? {width: 1080, height: 1920, objectFit: 'cover'}
              : {width: 1080, height: 1080}
          }
        />
      </AbsoluteFill>
      {/* 場面名テロップ: squareは上余白の中央、fullbleedは映像上部にオーバーレイ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 420,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: telopOpacity,
        }}
      >
        <span
          style={{
            fontFamily,
            fontWeight: telop.fontWeight,
            fontSize: telop.font_size ?? TELOP_DEFAULTS.font_size,
            color: COLORS.text,
            // fullbleedでは映像に文字が重なるため、白いにじみで可読性を確保
            textShadow: fullbleed
              ? '0 0 6px rgba(255,255,255,1), 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.95), 0 0 44px rgba(255,255,255,0.85), 0 0 70px rgba(255,255,255,0.6)'
              : undefined,
          }}
        >
          {cut.telop}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const Title = ({script}: {script: EpisodeScript}) => {
  const frame = useCurrentFrame();
  const title = {...TITLE_DEFAULTS, ...script.render.title};
  const fullbleed = script.render.layout === 'fullbleed';
  const opacity = interpolate(frame, [0, title.fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 420,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: title.fontWeight,
          fontSize: title.font_size ?? TITLE_DEFAULTS.font_size,
          color: COLORS.text,
          textShadow: fullbleed
            ? '0 0 6px rgba(255,255,255,1), 0 0 12px rgba(255,255,255,1), 0 0 24px rgba(255,255,255,0.95), 0 0 44px rgba(255,255,255,0.85), 0 0 70px rgba(255,255,255,0.6)'
            : undefined,
        }}
      >
        {title.text ?? script.title}
      </span>
    </div>
  );
};

export const Episode = (props: EpisodeScript) => {
  const script = props;
  const frame = useCurrentFrame();
  const globalFade = globalFadeAt(script, frame);
  const title = {...TITLE_DEFAULTS, ...script.render.title};
  const titleDurationInFrames = Math.round(
    (title.duration_sec ?? TITLE_DEFAULTS.duration_sec) * 30,
  );
  const total = totalDurationInFrames(script);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.background}}>
      {/* 映像・テロップは末尾で背景のクリーム色にフェードアウト */}
      <AbsoluteFill style={{opacity: globalFade}}>
        {script.cuts.map((cut, i) => (
          <Sequence
            key={cut.slug}
            from={cutStartFrame(script, i)}
            durationInFrames={clipDurationInFrames(cut)}
            premountFor={45}
          >
            <Clip script={script} cut={cut} index={i} />
          </Sequence>
        ))}
        {title.enabled ? (
          <Sequence from={total - titleDurationInFrames}>
            <Title script={script} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
