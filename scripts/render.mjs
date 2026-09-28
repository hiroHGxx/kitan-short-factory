#!/usr/bin/env node
/**
 * render.mjs — エピソードの script.json を Remotion (renderer/) に渡して
 * episodes/<ep>/out/{episode_slug}.mp4 を書き出す
 *
 * 使い方:
 *   node scripts/render.mjs episodes/ep001_chiisana-ichinichi
 *   node scripts/render.mjs episodes/ep001_chiisana-ichinichi --notes-only
 *     (レンダリングせず out/{episode_slug}_notes.md だけを再出力)
 *
 * 前提:
 *   - renderer/ で npm install 済み
 *   - script.json の各カットに対応する assets/cut{N}_{slug}.mp4 が存在すること
 *
 * 完了時に、SNS投稿文の材料になる作品ノート out/{episode_slug}_notes.md も出力する
 * (意図は script.json の concept フィールドから転記)。
 */

import {spawnSync} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RENDERER = path.join(ROOT, "renderer");

// MiniMax H3 の実尺(秒): max(5, round(sec*24)) を「17で割って5余る」フレーム数に
// 切り上げたもの @24fps(renderer/src/script.ts と同じ式)
function h3ActualSec(durationSec) {
  const base = Math.max(5, Math.round(durationSec * 24));
  const frames = base + ((((5 - (base % 17)) % 17) + 17) % 17);
  return frames / 24;
}

// SNS投稿文の材料になる作品ノートMDを out/ に書き出す
async function writeNotes(episodeDir, script) {
  const cuts = script.cuts;
  const crossfade = script.render?.crossfade_sec ?? 0.5;
  const totalSec =
    cuts.reduce((sum, c) => sum + h3ActualSec(c.duration_sec), 0) -
    crossfade * (cuts.length - 1);
  const today = new Date().toISOString().slice(0, 10);

  const cell = (s) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = cuts.map((c, i) =>
    `| ${i + 1} | ${cell(c.telop)} | ${c.duration_sec}秒 | ${cell(c.dialogue) || "(セリフなし)"} |`,
  );

  const concept =
    script.concept?.trim() ||
    "(script.json の `concept` が未記入です。作品の意図・ねらいを書いてから\n" +
      "`node scripts/render.mjs <エピソード> --notes-only` で再出力してください)";

  const md = `# ${script.title}(${script.episode_slug})

- 出力日: ${today}
- 完成品: ${script.episode_slug}.mp4(1080x1920・30fps・縦型ショート)
- 尺: 約${Math.round(totalSec)}秒・全${cuts.length}カット

## この動画の意図

${concept}

## カット構成

| # | テロップ | 尺 | セリフ・音メモ |
|---|---|---|---|
${rows.join("\n")}

## 制作情報(投稿文で技術に触れるとき用)

- 動画生成: MiniMax H3(ComfyUI・image-to-video・セリフ/環境音/BGMも同時生成)
- 起点画像: 手描き水彩風イラストを各カットの1フレーム目としてそのまま動かす方式
- 編集: Remotion(カット間クロスフェード${crossfade}秒・テロップ・エンディングタイトル)
`;

  const notesPath = path.join(episodeDir, "out", `${script.episode_slug}_notes.md`);
  await fs.mkdir(path.dirname(notesPath), {recursive: true});
  await fs.writeFile(notesPath, md, "utf8");
  return notesPath;
}

async function main() {
  const episodeDir = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2]) {
    console.error("使い方: node scripts/render.mjs <episodesフォルダ> [--notes-only]");
    process.exit(1);
  }
  const notesOnly = process.argv.slice(3).includes("--notes-only");

  const script = JSON.parse(
    await fs.readFile(path.join(episodeDir, "script.json"), "utf8"),
  );

  if (notesOnly) {
    const notesPath = await writeNotes(episodeDir, script);
    console.log(`作品ノート: ${path.relative(ROOT, notesPath)}`);
    return;
  }

  // レンダリング前チェック: 素材mp4が揃っているか
  const missing = [];
  for (const [i, cut] of script.cuts.entries()) {
    const asset = path.join(episodeDir, "assets", `cut${i + 1}_${cut.slug}.mp4`);
    try {
      await fs.access(asset);
    } catch {
      missing.push(path.relative(episodeDir, asset));
    }
  }
  if (missing.length > 0) {
    console.error(`素材が不足しています(先に generate.mjs を実行してください):`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  const outPath = path.join(episodeDir, "out", `${script.episode_slug}.mp4`);
  await fs.mkdir(path.dirname(outPath), {recursive: true});

  // props は一時ファイル経由で渡す(日本語・長文プロンプト対策)
  const propsPath = path.join(episodeDir, "out", ".render-props.json");
  await fs.writeFile(propsPath, JSON.stringify(script), "utf8");

  console.log(`エピソード: ${script.title} (${script.episode_slug})`);
  console.log(`カット数: ${script.cuts.length} / 出力: ${path.relative(ROOT, outPath)}`);

  const args = [
    "remotion",
    "render",
    "src/index.ts",
    "Episode",
    outPath,
    `--props=${propsPath}`,
    `--public-dir=${episodeDir}`,
  ];
  const result = spawnSync("npx", args, {
    cwd: RENDERER,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  await fs.rm(propsPath, {force: true});

  if (result.status !== 0) {
    console.error(`\nレンダリング失敗 (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
  const stat = await fs.stat(outPath);
  const notesPath = await writeNotes(episodeDir, script);
  console.log(`\n完了: ${outPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`作品ノート: ${path.relative(ROOT, notesPath)}`);
}

main().catch((e) => {
  console.error(`\nエラー: ${e.message}`);
  process.exit(1);
});
