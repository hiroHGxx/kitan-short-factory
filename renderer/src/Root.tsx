import {CalculateMetadataFunction, Composition} from 'remotion';
import {Episode} from './Episode';
import {EpisodeScript, FPS, totalDurationInFrames} from './script';

// Studio でエピソードを開かずに起動したとき用の最小プレースホルダ。
// 実レンダリングでは render.mjs が script.json を --props で渡して上書きする
const placeholder: EpisodeScript = {
  title: 'placeholder',
  episode_slug: 'ep000_placeholder',
  cuts: [
    {
      slug: 'placeholder',
      telop: '(no episode loaded)',
      h3_prompt: '',
      input_image: '',
      seed: 0,
      duration_sec: 10,
    },
  ],
  render: {crossfade_sec: 0.5, final_fadeout_sec: 1.5},
};

const calculateMetadata: CalculateMetadataFunction<EpisodeScript> = ({
  props,
}) => ({
  durationInFrames: totalDurationInFrames(props),
  fps: FPS,
  width: 1080,
  height: 1920,
});

export const RemotionRoot = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      defaultProps={placeholder}
      calculateMetadata={calculateMetadata}
      durationInFrames={300}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
