---
'@glenn203/prism': minor
---

Neutral defaults. Default surfaces, text, borders and controls use a twelve-step hued neutral band (`--prism-neutral-0`…`950`, OKLCH, hue 255, low chroma) so the everyday look is near black and white. Colour is reserved for meaning: invalid labels stay the error red, and a focused field's border uses the focus colour with a 50% ring (at most 4px). The spectral accent moves to an opt-in stylesheet, `prism/accent.css`. `--prism-color-slate-*` remains as an alias of the band. Typography token values are unchanged.
