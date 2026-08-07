import { pipeline, type TextGenerationPipeline } from '@huggingface/transformers';

// DECISIONS.md D16: the "open web" Style 3 prototype's core bet is that
// Staff's hard task (source_id search + link construction, where even
// full-size cloud LLMs have been observed fabricating source_ids) can be
// decomposed into a narrow, LLM-friendly sub-task -- extracting a single
// search keyword from free text -- plus deterministic steps (catalog
// search, later geocoding/link-building) that never touch the model. This
// module is exactly that narrow sub-task: extractKeyword() never sees a
// catalog and can't produce a source_id even if it tried.
//
// Qwen2.5-0.5B-Instruct. Fetched from the Hugging Face Hub CDN at runtime by
// @huggingface/transformers; no weights are bundled into this repo or the
// docs/ build output.
//
// dtype 'q4f16' (~480MB, the smallest published quantization for this
// model as of 2026-08) was tried first but fails at session creation with
// the onnxruntime-web build @huggingface/transformers 4.2.0 pulls in:
// "GetIndexFromName ... InsertedPrecisionFreeCast_/model/layers.22/
// input_layernorm/Constant_output_0 ... SimplifiedLayerNormFusion" -- a
// graph-optimizer bug specific to that fp16-fused variant, not something
// this module can work around. Plain int4 ('q4', ~786MB, no fp16 fusion)
// loads and runs without it.
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

let generatorPromise: Promise<TextGenerationPipeline> | null = null;

function getGenerator(onProgress?: (status: string) => void): Promise<TextGenerationPipeline> {
  if (!generatorPromise) {
    generatorPromise = pipeline('text-generation', MODEL_ID, {
      dtype: 'q4',
      progress_callback: (progress: { status: string; file?: string; progress?: number }) => {
        if (!onProgress) return;
        if (progress.status === 'progress' && progress.file) {
          onProgress(`${progress.file}: ${Math.round(progress.progress ?? 0)}%`);
        } else {
          onProgress(progress.status);
        }
      }
    }) as Promise<TextGenerationPipeline>;
  }
  return generatorPromise;
}

// Deliberately not JSON: a 0.5B model's structured-output reliability is
// unproven, and the failure mode of free-text drift (extra punctuation,
// stray quotes) is easy to clean up client-side, whereas a broken JSON
// parse would just throw. See DECISIONS.md D16 for the narrower-is-safer
// reasoning behind this whole module.
//
// A zero-shot version of this prompt (instruction only, no examples) was
// tried first and failed outright: the model ignored "output only the
// keyword" and produced a full explanatory sentence instead, cut off
// mid-word by max_new_tokens (DECISIONS.md D16). Few-shot examples (shown
// as prior user/assistant turns, not just described in prose) are the
// standard mitigation for small instruct models ignoring format
// constraints -- worth one try before concluding the decomposition itself
// doesn't hold.
const SYSTEM_PROMPT =
  '与えられた日本語の質問から、地図データを検索するための検索キーワードを1つだけ抜き出してください。' +
  '地名・災害の種類・地図データの種類などを表す名詞1語、または短い複合語です。' +
  '説明や理由を書かず、キーワードだけを1語で出力してください。';

const FEW_SHOT_EXAMPLES: Array<{ role: 'user' | 'assistant'; content: string }> = [
  { role: 'user', content: '令和8年熊本地震の被害状況が知りたい' },
  { role: 'assistant', content: '熊本地震' },
  { role: 'user', content: '石狩川の治水について考えたい' },
  { role: 'assistant', content: '石狩川 治水' },
  { role: 'user', content: '北海道の火山土地条件図を見たい' },
  { role: 'assistant', content: '火山土地条件図' }
];

export async function extractKeyword(question: string, onProgress?: (status: string) => void): Promise<string> {
  const generator = await getGenerator(onProgress);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...FEW_SHOT_EXAMPLES, { role: 'user', content: question }];
  const output = await generator(messages, { max_new_tokens: 16, do_sample: false });
  return cleanKeyword(extractGeneratedText(output));
}

// transformers.js's text-generation pipeline, called with a chat message
// array, returns [{ generated_text: Message[] }] -- the input messages with
// the new assistant turn appended (see its own TextGenerationChatOutput
// type, node_modules/@huggingface/transformers/types/pipelines/
// text-generation.d.ts).
function extractGeneratedText(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output;
  const generated = (first as { generated_text?: unknown } | undefined)?.generated_text;
  if (typeof generated === 'string') return generated;
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1] as { content?: string } | undefined;
    return last?.content ?? '';
  }
  return '';
}

function cleanKeyword(text: string): string {
  return text
    .trim()
    .split('\n')[0]
    .replace(/^[「"'『]+|[」"'』。、]+$/g, '')
    .trim();
}
