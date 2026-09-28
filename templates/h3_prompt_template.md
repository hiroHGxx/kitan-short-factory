# h3_prompt 定型構造

MiniMax H3 (i2v) 用プロンプトは必ずこの6ブロック構成・この順で書く。
英語で書き、日本語セリフだけ「」内に日本語で書く。

```
<1. 画風維持文>

Scene: <2. 場面説明>

Motion storyboard:
[0s-Ns] <動き>
[Ns-Ms] <動き>
...

Camera: <3. カメラ>

Audio: <4. 音声設計>

<5. ネガティブ指示>
```

## 各ブロックのルール

### 1. 画風維持文(冒頭・固定文)
毎回ほぼこのまま使う:

> Soft watercolor anime illustration style, keep the exact same hand-painted
> watercolor texture, soft pastel colors, paper grain and gentle lighting of
> the input image throughout. Do not change the character design or art style.

### 2. Scene
起点画像に写っているものを具体的に再記述する(キャラの特徴・服装・場所)。
画像任せにせず言葉でも固定するのが画風・キャラ維持のコツ。

### 3. Motion storyboard(秒数区切り)
- 10秒尺なら 3〜4 区間に分ける(例: [0s-3s] / [3s-6s] / [6s-8s] / [8s-10s])
- 1区間1アクション。動きは小さく・ゆっくりを基本にする(破綻防止)
- セリフがある場合はこのブロック内でタイミングを指定する:
  `and at 6.5s says in Japanese in a bright playful voice: 「いってらっしゃーい！」`

### 4. Camera
static / very slow pan / low angle など控えめに1文。激しいカメラワークは破綻しやすい。

### 5. Audio
効果音 + 環境音 + BGMの雰囲気 + セリフの再掲(タイミング付き)を1段落で:

> Audio: gentle flowing stream and soft water ripples, light birdsong and a
> faint breeze through grass, a nostalgic soft music-box melody underneath.
> Her line 「いってらっしゃーい！」 at 6.5s with a slight echo of open air.

### 6. ネガティブ指示(末尾・固定文)

> No text, subtitles, logos or watermarks. Keep the watercolor illustration
> look from the first frame to the last frame, do not become photorealistic,
> do not change the character design.

## 既知の破綻パターンと対策(ep003で実証)

- **起点画像に写っていない小道具は浮く・出現が破綻する**(例: 傘)。
  props は極力書かない。書くなら起点画像に写っているものだけにする
- **水・雨系のシーン + セリフの口の動き → 口から水しぶきが出る**。
  ネガティブ指示(no spray from mouth 等)やseed変更では消えないことがある。
  効く対策は構図変更: セリフの瞬間は顔を遠くへ向けさせ、口元を画面上で
  小さくする(three-quarter view / face turned away)
- **セリフのイントネーションが不自然** → seed変更で直ることもあるが、
  セリフ冒頭に「あ、」等の一拍を入れる+voice指示に
  "natural falling intonation" を足す方が確実だった
- **起点画像が「目を閉じた顔」のカットは、開眼時に瞳の色が変わる**(ep015で実証。
  緑髪に引っ張られて琥珀色→緑目になった)。seed変更では直らない。
  開眼するstoryboard区間に "opens her warm orange-amber eyes (the same amber
  eye color as always)" のように瞳の色を明記する
- **発話を連想させるジェスチャー(合掌のごちそうさま等)は、セリフなしカットでも
  不明瞭な発話を誘発する**(ep015 cut5で実証)。"No spoken words" だけでは不十分。
  対策: storyboard側で "silent thank-you gesture ... giving thanks in her heart
  without speaking" のように「心の中で」を明示し、Audioブロックも
  "Completely no voice: no spoken words, no whisper, no humming, no murmur" まで強化する

## 完全な実例

comfyui/video_minimax_h3_i2v.json の `105:104`.inputs.prompt に入っている
「紙の舟」カットが上記構造の実例そのもの。迷ったらそれを開いて参照する。
