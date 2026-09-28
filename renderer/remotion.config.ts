import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// publicDir は固定しない。render.mjs が --public-dir でエピソードフォルダを渡し、
// staticFile('assets/cutN_*.mp4') がそのエピソードの素材を指すようにする。
// Studio で確認したいときは: npx remotion studio --public-dir=../episodes/ep001_chiisana-ichinichi
