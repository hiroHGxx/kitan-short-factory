#!/usr/bin/env node
/**
 * extract-frames.mjs — 各カットの中間・終盤フレームをPNG抽出する(破綻チェック用)
 *
 * 使い方:
 *   node scripts/extract-frames.mjs episodes/ep010_yoru-no-radio
 *   node scripts/extract-frames.mjs episodes/ep010_yoru-no-radio --only oyasumi
 *
 * 作成物: episodes/<slug>/check/cut{N}_{slug}_{mid|end}.png
 * ffmpeg は Remotion 同梱のもの(renderer/node_modules)を使うため追加インストール不要。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = path.join(
  ROOT, "renderer", "node_modules",
  "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe"
);

const args = process.argv.slice(2);
const epArg = args[0];
if (!epArg) {
  console.error("使い方: node scripts/extract-frames.mjs <episodes/epNNN_slug> [--only <cutのslug>]");
  process.exit(1);
}
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

const epDir = path.resolve(ROOT, epArg);
const script = JSON.parse(fs.readFileSync(path.join(epDir, "script.json"), "utf8"));
const checkDir = path.join(epDir, "check");
fs.mkdirSync(checkDir, { recursive: true });

let done = 0;
script.cuts.forEach((cut, i) => {
  if (only && cut.slug !== only) return;
  const name = `cut${i + 1}_${cut.slug}`;
  const mp4 = path.join(epDir, "assets", `${name}.mp4`);
  if (!fs.existsSync(mp4)) {
    console.warn(`スキップ(未生成): assets/${name}.mp4`);
    return;
  }
  const grab = (ssArgs, suffix) =>
    execFileSync(FFMPEG, [
      "-loglevel", "error", ...ssArgs, "-i", mp4,
      "-frames:v", "1", "-y", path.join(checkDir, `${name}_${suffix}.png`),
    ]);
  grab(["-ss", String(cut.duration_sec / 2)], "mid");
  grab(["-sseof", "-1"], "end");
  console.log(`抽出: check/${name}_{mid,end}.png`);
  done++;
});
console.log(`完了: ${done}カット分を ${path.relative(ROOT, checkDir)} に抽出`);
