# 生成経路の検討(2026-09-28)

問い: 「月蝕綺譚の公式素材を使い、MiniMax H3 Turbo で動画を作る。起点画像は GPT Image(codex)で
作る必要があるか? ComfyUI の参照画像(三面図)から動画を作る機能で不要にできるか?」

## 1. 前提として確認できた事実

**公式側**
- 設定資料MCP(認証不要HTTP)が3本: `kitan-lore`(月蝕綺譚)/ `cn-lore`(原作)/ `yoiyami`(素材庫)
- `get_spirit` でキャラの口調・一人称・セリフ例・正典シート画像・**ボイスサンプル**が取れる
- `get_design_tone` に配色(6色HEX)と「画像生成アンカー」がある → 画風維持文の材料
- 正典シートは三面図・表情・ちび・衣装違いまで揃い、**AIに読み込ませてよい**と明記
- 楽曲14曲は動画BGM・主題歌として使用OK。ボイスサンプル(Irodori-TTS用WAV)はAIに読ませて喋らせてOK
- 札絵(1キャラ10枚)、紹介動画、カットイン、背景などゲーム素材が約1,125点

**手元の環境**(ComfyUI 0.37.0 / RTX 4070 SUPER 12GB)
- H3 i2v(FL2VA)+ Turbo v1.2 4steps: 導入・実証済み(10秒尺 約2.7分)
- **`MiniMaxH3ReferenceToVideo`(Ref2VA)ノードは入っている**。入力: 参照画像最大9枚・参照動画3本・**参照音声3本**、`ref_image_size`(match / max)
- **`MiniMaxH3AddGuide`** ノードもある: 任意フレームに画像・音声のガイドを固定できる
- **未導入**: Ref2VA 本体 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`(約21GB)と
  Ref2V用 Turbo LoRA(`minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_resized_avg_rank_64_bf16`、978MB 等)
- 参照: https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native 、
  姉妹プロジェクトの `work/派生プロジェクト指示書_storyboard-anime-factory.md` §2(Ref2VA技術要点)

## 2. 起点画像の用意の仕方: 4案

| | A: i2v + codex起点画像 | B: Ref2VA(参照のみ) | C: i2v + 公式素材を直接起点 | D: Ref2VA + AddGuide(1フレーム目固定) |
|---|---|---|---|---|
| 起点画像 | 正典シートを添付してcodex(GPT Image)で場面ごとに生成 | 不要。三面図・表情シート・背景を `<Picture N>` で参照 | 札絵・背景・イラストをそのまま(縦長化だけ加工) | codex等で作った起点画像+参照シート |
| キャラの忠実度 | 高(codexの再現力次第。おえんで実績) | 参照シート次第(**未検証**) | 最高(公式絵そのもの) | 高 |
| 構図の制御 | 完全(1フレーム目=画像) | 言葉のみ(冒頭の絵は制御できない) | 素材の構図に縛られる | 完全 |
| **キャラの声** | 言葉で指定するだけ | **公式ボイスを `<Audio 1>` で参照できる可能性** | 言葉のみ | 参照できる可能性 |
| 追加準備 | なし(即着手可) | 21GB+LoRA、ワークフロー新規 | なし | Bと同じ+検証 |
| 速度・VRAM | 実証済み | 参照画像分重い(**未検証**) | 実証済み | 未検証 |
| トークン消費 | codex(ChatGPT定額内) | なし | なし | codex |

## 3. 結論(推奨)

1. **GPT Image は「必須」ではないが、当面は保険として残す。**
   本作の最大の差別化要素は「公式キャラらしさ(見た目+**声**)」。Ref2VAは参照音声で
   公式ボイスに寄せられる可能性があり、i2v では原理的にできない。ここを最優先で検証する価値が高い
2. **最初の検証で B(Ref2VA)を A(i2v+codex)と同じ台本で比較する。**
   - Bで見た目・声・構図が実用十分 → GPT Image 不要の完全ローカル経路が標準になる
   - 冒頭の構図だけが問題 → D(AddGuideで1フレーム目を固定)を試す
   - Bが不十分 → Aを標準にし、Cを要所(ラストカット等)で使う
3. **C は検証なしで即使える補助手段。** 札絵をそのまま動かすカットは、生成ゼロで公式品質になる
4. MCP の役割: 台本段階で `get_spirit`(口調・セリフ例)・`get_worldview`・`get_design_tone` を引き、
   キャラ解釈の誤りを防ぐ。画像・音声のURLも MCP から取得し `refs/{キャラ}/` にキャッシュする

## 4. 検証計画(第1ステップ)

- [x] MCP を接続し、1キャラ(候補: 咲耶=甲賀・火、明るい姉御肌「あたし」)のプロフィール・シート・ボイスを取得
- [x] Ref2VA 本体(約21GB)+ Ref2V Turbo LoRA をダウンロード
- [x] ComfyUI の公式テンプレートから Ref2VA の API ワークフローを作成(`comfyui/video_minimax_h3_ref2v_turbo.json` / `_guide_turbo.json`)
- [x] 同じ10秒1カット(セリフあり)を A と B で生成し比較 → D も追加し、3キャラで B/D を再比較(§6)
- [x] SKILL.md(運用手順)を作る → `.claude/skills/kitan-short-factory/SKILL.md`

## 5. 画風について

おえんちゃん用テンプレートの「画風維持文」は水彩前提。本作は公式のアニメ調ダークファンタジー
(「宵闇に金」)なので、`get_design_tone` の画像生成アンカーを元に画風維持文を作り直すこと。

## 6. 検証結果(2026-09-28)→ **D を標準に採用**

### 条件
- 9:16・0.4MP(480x864)・10秒・seed 20260928・24fps。台本は各キャラ1カット(横向き→振り向き→5.5秒からセリフ)
- A: `video_minimax_h3_i2v_turbo.json`(FL2V Turbo v1.2 / 4step)+ codex起点画像
- B: `video_minimax_h3_ref2v_turbo.json`(Ref2VA pruned int8 + Ref2V Turbo LoRA v1.0 768p rank64 / 8step / euler・beta)
  参照 = 正典立ち絵 <Picture 1> + 三面図シート <Picture 2> + 公式ボイス見本WAV <Audio 1>、`ref_image_size=match`
- D: `video_minimax_h3_ref2v_guide_turbo.json` = B + `MiniMaxH3AddGuide`(frame 0 に A と同じ codex起点画像)
- 作品: `episodes/ep000_sakuya-engawa`(咲耶で A/B/D)、`episodes/ep000_route-compare`(餡音・イズナ・ナルカで B/D)

### 結果
| | A: i2v | B: Ref2VA | D: Ref2VA+AddGuide |
|---|---|---|---|
| キャラの見た目 | 正典どおり(codex画像に依存) | 正典に非常に忠実 | 正典に非常に忠実 |
| トーン・構図 | 起点画像どおり | **制御不能**: 桜が淡ピンク〜白・空が青・引きの全身構図。色指定を強めても変わらず | 起点画像どおり(宵闇藍・暗紫の夜桜) |
| 声 | 冒頭が低くかすれる | かすれ無し・公式ボイスに近い | 公式ボイスに近い |
| リップシンク | — | 良好 | 話し始めに多少のずれ(ユーザー評価「あまり気にならない」) |
| 発音 | 正確 | 「あ、」が二重・「来たが来た」(v2で解消) | 概ね正確。餡音「お団子**が**食べようよ」、ナルカは片言・不自然なイントネーション |
| 生成時間 | 3.0分 | 5.0〜5.3分 | 5.0〜5.3分 |
| VRAM ピーク | 未計測 | 11.7GB / 12.3GB | (Bと同等) |

**結論(ユーザー判断)**: 発色とトーンを考えると D が良い。リップシンクもあまり気にならない。発音の粗(助詞の混入等)は
チェック工程で拾えばよい → **標準経路 = D(`generate.mjs --ref2v`)**。起点画像は codex CLI で作る(§1 の案Aの画像作りは残る)。

### 分かったこと(台本・プロンプトの書き方に反映済み: `templates/h3_prompt_template.md`)
- セリフ冒頭の「あ、」は Ref2VA では有害(二重に響き、誤発音を誘発)。外しても口の動きに違和感は出ない
- 誤読しそうな語は `(来た来た is pronounced "kita kita")` と読みを添える
- ボイス見本が ElevenLabs Voice ID のみのキャラ(於兎)は WAV が無く <Audio> 参照不可。咲耶・餡音・イズナ・ナルカは WAV(irodori)あり。他キャラは使う前に \`get_spirit\` の voice_sample.kind を確認する
- whisper.cpp(`D:/AI/tools/whisper.cpp`)の文字起こしは冒頭の短い語を落とすことがある。セリフの最終判定は耳で行う

### 未解決・今後
- ナルカ(お嬢様口調)の片言: seed 違い・セリフ言い換え・ボイス見本の差し替え等で改善するか
- D の話し始めのリップずれ: AddGuide を frame 0 のみにしている影響か未切り分け
- `ref_image_size=max`(参照忠実度優先・遅い)は未検証。VRAM がほぼ上限なので要注意
