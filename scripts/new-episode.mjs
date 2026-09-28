#!/usr/bin/env node
/**
 * new-episode.mjs — エピソードフォルダの雛形を作成する
 *
 * 使い方:
 *   node scripts/new-episode.mjs ep001_sakuya-no-yoru
 *   node scripts/new-episode.mjs ep001_sakuya-no-yoru --base refs/sakuya/sakuya_canon.png
 *
 * 作成物: episodes/<slug>/{inputs,assets,out}。--base 指定時のみその画像を inputs/ にコピー
 * script.json は作らない(台本はドラフト時に別途書く)。既存ファイルは上書きしない。
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const slug = args[0];
if (!slug || !/^ep[0-9]{3}_[a-z0-9-]+$/.test(slug)) {
  console.error("使い方: node scripts/new-episode.mjs <epNNN_slug> [--base <画像パス>]");
  process.exit(1);
}
const baseIdx = args.indexOf("--base");
const basePath = baseIdx >= 0 ? path.resolve(args[baseIdx + 1]) : null;

const epDir = path.join(ROOT, "episodes", slug);
for (const d of ["inputs", "assets", "out"]) {
  await fs.mkdir(path.join(epDir, d), { recursive: true });
}
if (basePath) {
  const destImage = path.join(epDir, "inputs", path.basename(basePath));
  try {
    await fs.copyFile(basePath, destImage, fs.constants?.COPYFILE_EXCL ?? 1);
    console.log(`起点画像をコピー: ${path.relative(ROOT, destImage)}`);
  } catch (e) {
    if (e.code === "EEXIST") console.log(`起点画像は既に存在: ${path.relative(ROOT, destImage)}`);
    else throw e;
  }
}
console.log(`作成完了: ${path.relative(ROOT, epDir)}\\{inputs,assets,out}`);
