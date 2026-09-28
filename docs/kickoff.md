# 立ち上げ引き継ぎ(2026-09-28、short-video-factory セッションより)

kitan-short-factory の第1ステップ(生成経路の比較検証)を開始する。

## 最初にやること
1. `CLAUDE.md` と `docs/pipeline-design.md` を読む
2. MCP(kitan-lore / cn-lore / yoiyami)がこのセッションで使えるか確認する。
   使えなければ、ユーザーに登録を依頼して待つ(登録コマンドは CLAUDE.md にある。
   **`.mcp.json` の作成や `claude mcp add` を自分で実行しないこと**。
   姉妹プロジェクト側で auto mode の分類器に止められ、ユーザー判断待ちの操作のため)
3. 検証用のキャラを1人決めて素材を集める(候補: 咲耶=甲賀・火、一人称「あたし」の明るい姉御肌)。
   `get_spirit`(プロフィール・口調・セリフ例・シート・ボイス)、`get_design_tone`(配色・画像生成アンカー)、
   `get_guidelines`(最新ガイドライン)
4. 結果を短く要約してユーザーに見せ、検証用の10秒カット(セリフあり)の台本案を1本提示する。
   画風維持文は `get_design_tone` を元に作り直す(templates/ は水彩前提のため)

## ユーザー判断待ち(勝手に進めない)
- `.gitignore` に `refs/` を追加するか(公式素材キャッシュを git から外す)
- Ref2VA本体 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`(約21GB)と
  Ref2V Turbo LoRA `minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_resized_avg_rank_64_bf16.safetensors`
  (drbaph/MiniMax-H3-Turbo-Lora-ComfyUI、978MB)のダウンロード。保存先は D:\AI\ComfyUI_windows_portable\ComfyUI\models\ 配下
- GitHub プライベートリポジトリの作成(今はローカルgitのみ)

## 環境メモ
- ComfyUI v0.37.0(http://127.0.0.1:8188)。`MiniMaxH3ReferenceToVideo` と `MiniMaxH3AddGuide` ノードは導入済み
- RTX 4070 SUPER 12GB。i2v Turbo は FL2V v1.2 4steps(姉妹プロジェクトで検証済み・10秒尺約2.7分)
- generate.mjs の監視はメモリ逼迫で Claude Code に止められることがある。ComfyUIのキューは継続するので `--collect` で回収する
- ユーザーはスマホのリモコン画面から操作していることがある。動画は SendUserFile で送る(上限30MB)
