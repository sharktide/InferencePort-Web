> Generate text, images, video, audio, realtime voice, and embeddings with a single API. OpenAI-compatible — use any OpenAI SDK by changing the base URL.

**Base URL:** `https://gen.pollinations.ai`

**Get your API key:** [enter.pollinations.ai](https://enter.pollinations.ai/keys)

**Model catalog migration:** model IDs now use `publisher/model` names. Existing aliases remain valid in requests; match catalog entries against both their canonical ID and `aliases` when restoring saved selections. Catalog metadata uses `publisher` (for example, `OpenAI`) instead of `brand`; update clients reading that field. `publisher` identifies the model publisher, not the inference provider. The existing `brand_url` logo field is unchanged. See the [live model catalog](https://gen.pollinations.ai/models) for current IDs and aliases.

**Integrations:** [Connect User Wallets](/docs#tag/connect-user-wallets) · [Publish a Model](/docs#tag/publish-a-model) · [Publish an Agent](/docs#tag/publish-an-agent) · [MCP Servers](/docs#tag/mcp-servers) · [CLI](/docs#tag/cli)

## Quick Start

### Text (Python, OpenAI SDK)

```python
from openai import OpenAI
client = OpenAI(base_url="https://gen.pollinations.ai/v1", api_key="YOUR_API_KEY")
response = client.chat.completions.create(model="openai/gpt-5.4-nano", messages=[{"role": "user", "content": "Hello!"}])
print(response.choices[0].message.content)
```

### Image (URL — no code needed)

```plaintext
https://gen.pollinations.ai/image/a%20cat%20in%20space?model=flux
```

### Audio (cURL)

```bash
curl "https://gen.pollinations.ai/audio/Hello%20world?voice=nova" \
  -H "Authorization: Bearer YOUR_API_KEY" -o speech.mp3
```

### 3D (cURL)

```bash
curl "https://gen.pollinations.ai/3d/no_prompt_for_trellis_needed?image=https://inferenceport.ai/img/trellis.jpg&model=microsoft%2Ftrellis-2&resolution=low" \
  -H "Authorization: Bearer YOUR_API_KEY" -o model.glb
```

### Embeddings (OpenAI-compatible)

```bash
curl https://gen.pollinations.ai/v1/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/text-embedding-3-small","input":"Hello world","dimensions":512}'
```

See `GET /v1/models` for every text, image, audio, video, and embedding model available.

## Authentication

All generation requests require an API key from [enter.pollinations.ai](https://enter.pollinations.ai/keys). Model listing endpoints work without authentication.

| Type | Prefix | Use case | Rate limits | Description |
|------|--------|----------|-------------|-------------|
| Secret | `sk_` | Server-side apps | None | Personal developer key. Never expose in client-side code. |
| App Key (Connect User Wallets) | `pk_` with redirect URIs | Client apps via OAuth / device flow | None on the App Key itself | Publishable App Key used as the OAuth `client_id`. Users authorize; your app receives a scoped `sk_`. |
| Raw publishable | `pk_` with no app binding | Legacy direct spend | 1 pollen / IP / hour | Retained for existing integrations. Do not mint new ones. |

> **Note:** Raw publishable keys (`pk_` used as a generation key in browsers) are **legacy**, not beta. New frontend and mobile apps should use **Connect User Wallets**, also called BYOP (Bring Your Own Pollen): register an App Key at [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys), then run the OAuth authorization-code flow with PKCE (or the device flow) to obtain a temporary user-authorized secret key (`sk_`). The legacy fragment redirect and device flow remain supported.

Two ways to authenticate generation requests:

- Header: `Authorization: Bearer YOUR_API_KEY`
- Query param: `?key=YOUR_API_KEY`

For detailed integration guidance on user-pays authorization, including OAuth discovery and token exchange, see [Connect User Wallets](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md).

## Text Generation

Generate text using OpenAI-compatible Chat Completions and stateless Responses APIs — use an OpenAI SDK by changing the base URL.

| Endpoint | Best for |
|----------|----------|
| `POST /v1/chat/completions` | Full OpenAI compatibility — streaming, tools, vision, structured outputs |
| `POST /v1/responses` | Stateless Responses input/output items, semantic streaming events, and function tools |
| `POST /v1/messages` | Anthropic Messages API — Claude Code and the Anthropic SDKs |
| `GET /text/{prompt}` | Quick prototyping — simple GET, returns plain text |

**Available models:** openai/gpt-5.4-nano, openai/gpt-5-nano, openai/gpt-oss-20b, openai/gpt-4o-mini, openai/gpt-5.3-codex, openai/gpt-5.4, openai/gpt-5.4-mini, openai/gpt-5.5, openai/gpt-5.6-sol, openai/gpt-5.6-terra, openai/gpt-5.6-luna, openai/gpt-6-astra, openai/gpt-6-sol, openai/gpt-6.1-sol, openai/gpt-6-luna, inception/mercury-2, inception/mercury-2.5-preview, cohere/command-a-plus, qwen/qwen3-coder-30b-a3b-instruct, mistralai/mistral-small-3.2, mistralai/mistral-small-4, openai/gpt-audio-mini, openai/gpt-audio-1.5, google/gemini-3-flash-preview, google/gemini-3.7-flash, google/gemini-3.8-flash, google/gemini-3.5-flash-lite, google/gemini-2.5-flash-lite, deepseek/deepseek-v4-flash, deepseek/deepseek-v4.1-flash, deepseek/deepseek-v4-flash-vision-exp, google/gemma-4-26b-a4b-it, google/gemma-4-31b-it, deepseek/deepseek-v4-pro, x-ai/grok-4.20, x-ai/grok-4.3, x-ai/grok-4.6, x-ai/grok-4.7, google/gemini-2.5-flash-lite:search, respan/span-01-lite, typesafe/jev-1.13, jaredpalmer/kev-4b, liquid/d1, pollinations/midijourney, pollinations/midijourney-large, anthropic/claude-haiku-4.5, anthropic/claude-sonnet-4.6, anthropic/claude-sonnet-5, anthropic/claude-sonnet-5.5, anthropic/claude-opus-4.6, anthropic/claude-opus-4.7, anthropic/claude-opus-5, anthropic/claude-opus-5.5, anthropic/claude-fable-5, anthropic/claude-fable-5.1, perplexity/sonar, moonshotai/kimi-k2.6, moonshotai/kimi-k2.7-code, moonshotai/kimi-k3, poolside/laguna-s-2.1, tencent/hy4-preview, tencent/hy3, inclusionai/ling-3.1-flash, inclusionai/ling-3.0-flash-vl, meituan/longcat-2.0, thinkingmachines/inkling-small, thinkingmachines/inkling, nvidia/nemotron-3-ultra, nvidia/nemotron-3.5-lightning, xiaomi/mimo-v2.5, xiaomi/mimo-v2.5-pro, xiaomi/mimo-v2.6-flash, xiaomi/mimo-v2.6-pro, google/gemini-3.1-pro-preview, amazon/nova-micro-v1, amazon/nova-2-lite-v1, z-ai/glm-5.2, z-ai/glm-5.3, z-ai/glm-5.3-flash, z-ai/glm-5.3-flashx, meta/llama-3.3-70b-instruct, meta/llama-4-maverick, meta/llama-4-scout, minimax/minimax-m2.7, minimax/minimax-m3, meta/muse-glimmer-30b, meta/muse-spark-1.2, mistralai/mistral-large-3, qwen/qwen3-coder-next, qwen/qwen3.7-plus, qwen/qwen3.7-max, qwen/qwen3.8-2.4t-a95b, qwen/qwen3.8-27b, qwen/qwen3.8-max, qwen/qwen3.8-max-0902, qwen/qwen3.8-flash, qwen/qwen3.7-flash, qwen/qwen3-vl-30b-a3b-instruct, qwen/qwen3-vl-235b-a22b-thinking, stepfun/step-3.7-flash, stepfun/step-3.5-flash, qwen/qwen3guard-gen-8b

### Responses API

Use `supported_endpoints` from [`GET /v1/models`](/v1/models) or [`GET /text/models`](/text/models) to find models that advertise `/v1/responses`. This includes configured built-in providers, community text models with an exact Responses URL, external endpoint agents with an exact Responses URL, and managed prompt agents.

```bash
curl https://gen.pollinations.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -d '{
    "model": "openai",
    "input": "Explain why the sky is blue in two sentences.",
    "store": false
  }'
```

The endpoint is deliberately stateless. `store` must be `false`; `previous_response_id`, `conversation`, and `prompt` must be null or omitted; `background` must be false or omitted; and encrypted content or reusable item references are rejected. Streaming uses Responses event names and terminal usage events. Direct models preserve the provider's terminal marker; managed-agent streams add one `data: [DONE]` marker. For text models, missing or malformed usage on a completed or incomplete response fails the request. Failed responses may report null usage. These failed requests are not billed, but completed child model calls and charged MCP operations within an agent run remain billable; the outer agent request adds no charge.

The stateless surface follows the OpenAI Responses API and OpenResponses item/event vocabulary. It does not claim full OpenResponses conformance: persisted continuation, conversations, compaction, background jobs, Responses WebSocket transport, and normalization of every direct provider stream are outside this subset.

Community text models and endpoint agents declare one upstream API and one exact URL. A Responses registration accepts both public APIs: Responses requests use the selected endpoint directly, while Chat Completions requests use the shared stateless adapter. A Chat Completions registration accepts Chat Completions only. Built-in models can have separate routes for the two public APIs; advertising Responses does not mean their Chat requests use the adapter.

Managed prompt agents run configured MCP tools on the server. Send previous response items back to continue a conversation; completed tools are not run again.

Managed prompt agents accept `reasoning.effort` (Responses) and `reasoning_effort` (Chat Completions). Reasoning summaries are not supported: a non-null `reasoning.summary` returns HTTP 400.

### Anthropic Messages API

Models that list `/v1/messages` in `supported_endpoints` — every text model that supports Chat Completions — also accept Anthropic Messages requests. Point Claude Code or an Anthropic SDK at `https://gen.pollinations.ai` and authenticate with a bearer token:

```bash
export ANTHROPIC_BASE_URL=https://gen.pollinations.ai
export ANTHROPIC_AUTH_TOKEN=$POLLINATIONS_API_KEY
export ANTHROPIC_MODEL=openai
claude
```

```python
import os

import anthropic

client = anthropic.Anthropic(
    base_url="https://gen.pollinations.ai",
    auth_token=os.environ["POLLINATIONS_API_KEY"],
)
message = client.messages.create(
    model="openai",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    baseURL: "https://gen.pollinations.ai",
    authToken: process.env.POLLINATIONS_API_KEY,
});
const message = await client.messages.create({
    model: "openai",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }],
});
```

Requests run as Chat Completions requests: balance checks, key permissions, rate limits, caching and billing are the same. Streaming, tools, images, system prompts and stop sequences depend on the selected model's capabilities; see [`/text/models`](/text/models). `cache_control` uses the same provider support as Chat Completions (see Prompt caching below); custom cache TTLs are not supported. `thinking` sets `reasoning_effort` (`output_config.effort` for adaptive thinking), and provider reasoning returns as `thinking` blocks. Usage reports `input_tokens`, `output_tokens`, `cache_read_input_tokens` and `cache_creation_input_tokens`; a response without provider usage fails, and a stream ends with an `error` event. Errors use Anthropic's error shape. `/v1/messages/count_tokens`, batches, files, server tools and `x-api-key` authentication are not supported.

Claude Code sends `cache_control` automatically. Fireworks-hosted models that reject this field cannot currently be used with Claude Code; see [the compatibility issue](https://github.com/pollinations/pollinations/issues/15682).

### Media models in conversations

Image, video, audio and 3D models that advertise these endpoints in [`/models`](/models) accept a text prompt. Only the last user message is used; history, instructions and text-generation settings are ignored. Its text parts (or a string Responses `input`) form the prompt. Image parts (`image_url` in Chat, `input_image` in Responses, as URLs or data URIs) are the source images of image models and the start frame of video models that list `image` under `input_modalities`, exactly as `/v1/images/edits` does; other models, including 3D, return HTTP 400 for them, and any other attachment type returns HTTP 400. Use the native media endpoints for generation settings.

Text models with `video` under `input_modalities` (for example `inclusionai/ling-3.0-flash-vl`) accept `video_url` parts the same way they accept `image_url`: a public `https://` URL or a `data:video/...;base64,...` data URI (Gemini models also accept YouTube and `gs://` URLs). Video usage is metered from the provider's reported `video_tokens` detail and billed against the model's video prompt rate.

Empty prompts, malformed Unicode and prompts consisting only of `.` or `..` return HTTP 400. Reference-required models return their normal missing-input error.

Dialogue models expect one `<voice>: <text>` turn per line, just like `/audio`. Community speech models available only through `/v1/audio/speech` are not included.

```bash
curl https://gen.pollinations.ai/v1/responses \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"flux","input":"A lighthouse at dawn"}'

curl https://gen.pollinations.ai/v1/chat/completions \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"flux","messages":[{"role":"user","content":"A lighthouse at dawn"}]}'
```

Both return assistant text: a Markdown image embed for images, or a Markdown link for audio, video and 3D, followed by the plain public file URL. The URL is also in the `Link` header. With `stream: true`, events arrive after generation finishes.

Media uses its normal billing units, not text tokens: Responses returns `usage: null`; Chat JSON omits `usage`. Chat streaming chunks contain `usage: null`, with no final usage chunk. Video uses the native model or provider's default duration.

### Reasoning

Use `reasoning_effort` to control reasoning on models that advertise reasoning support.

```bash
# POST /v1/chat/completions — OpenAI-compatible response
curl https://gen.pollinations.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -d '{
    "model": "openai",
    "reasoning_effort": "high",
    "messages": [
      { "role": "user", "content": "Prove that there are infinitely many prime numbers." }
    ]
  }'
```

```bash
# POST /text — plain-text response
curl https://gen.pollinations.ai/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -d '{
    "model": "openai",
    "reasoning_effort": "medium",
    "messages": [
      { "role": "user", "content": "Design a URL shortener. Outline the key tradeoffs." }
    ]
  }'
```

### Prompt caching

On Gemini, Claude, and Nova models, a large static prompt prefix can be cached so repeat requests bill it at a fraction of the input rate. Mark the end of the static prefix with `cache_control` on a content block (not on the message); everything before the marker must be byte-identical across requests, everything dynamic goes after. The first request creates the cache (`usage` reports `cache_creation_input_tokens`); repeat requests within the TTL report `prompt_tokens_details.cached_tokens` at the discounted rate.

```json
{
  "model": "google/gemini-2.5-flash-lite",
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "<large static prompt>",
          "cache_control": { "type": "ephemeral" }
        }
      ]
    },
    { "role": "user", "content": "<dynamic message>" }
  ]
}
```

**Gemini** — the prefix must be at least ~2,048 tokens (~4,096 on Gemini 3 models). Requests with tools are not cached — including built-in tools, so `google/gemini-3.7-flash`, `google/gemini-3-flash-preview`, `google/gemini-3.1-pro-preview`, and the search variants only cache when tools are disabled (`"tools": []`) or a JSON `response_format` is set; `google/gemini-2.5-flash-lite` and `google/gemini-3.5-flash-lite` cache by default. Cache creates bill at the standard input rate plus a storage fee for the 1-hour TTL ($1 per 1M cached tokens on Flash models, $4.50 on Pro); hits bill at ~10% of input. The storage fee means caching pays off only when the prefix is reused often — roughly a dozen reuses per hour on the cheapest models.

**Claude** — all Claude models cache. The prefix minimum varies by model: 512 tokens on `anthropic/claude-fable-5`, `anthropic/claude-fable-5.1`, and `anthropic/claude-opus-5`, and 1,024 on `anthropic/claude-sonnet-4.6`; other models have higher minimums. Tool definitions are cacheable. `anthropic/claude-fable-5.1` accepts only automatic or disabled tool choice; forcing any or a named tool returns a 400. Cache creates bill at 1.25× the input rate (no storage fee); hits bill at 10% of input, or 2.5% on `anthropic/claude-fable-5.1`. The cache lives ~5 minutes, refreshed on each hit.

**Nova** — `nova` and `nova-fast` cache. The prefix must be at least ~1,000 tokens (up to 20K tokens cacheable). Cache creates are free; hits bill at 25% of input. ~5-minute TTL.

Models that advertise `/v1/responses` also accept OpenAI's cache controls. Set `prompt_cache_options.mode` to `explicit` and place `prompt_cache_breakpoint: { "mode": "explicit" }` on the content block ending each stable prefix (up to four). Chat requests adapted to Responses preserve these markers; the existing `cache_control: { "type": "ephemeral" }` marker is translated to the same explicit breakpoint. Managed prompt agents apply an explicit request without caller markers to their configured static prompt.

### Typed decisions (`typesafe/jev-1.13`)

`typesafe/jev-1.13` (aliases `jev` and `typesafe/jev`) returns calibrated judgments instead of free text. Post `state` and a map of `questions` to `POST /alpha/decisions`; each question is a `choice`, `score`, or `noul`, and each is answered independently under the key you supplied. `model` defaults to `jev`.

```json
{
  "state": "My payouts have been failing for 3 days.",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": { "billing": "Payment issues", "technical": "Product failures" }
    },
    "is_urgent": { "type": "noul", "instructions": "Does this convey urgency?" }
  }
}
```

The response carries `answers`, one field per question, each with `type` and its native fields (`choice` + `confidence` + `probabilities`, `score` + `legend` + `confidence` + `probabilities`, or `noul`), plus `usage` with `input_tokens` and `output_tokens`. See the [TypeSafe API reference](https://docs.typesafe.ai/api) for the native request and answer shapes.

```json
{
  "id": "dec-…",
  "model": "typesafe/jev-1.13",
  "provider": "TypeSafe",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.82,
      "probabilities": { "billing": 0.91, "technical": 0.09 }
    },
    "is_urgent": { "type": "noul", "noul": 0.87 }
  },
  "usage": { "input_tokens": 312, "output_tokens": 48 }
}
```

`state`, `instructions`, and criteria values accept a string or arbitrary JSON. There is no streaming; the answers arrive in one response.

The same model is also reachable from an OpenAI client on `/v1/chat/completions`: put the identical request JSON in the last `user` message as a string, and the answers come back as `message.content`. Earlier turns, system instructions, and text-generation settings are ignored. With `stream: true` the finished answers arrive as one content chunk followed by the usage chunk. Prefer `/alpha/decisions` where you can post the native shape.

Supply relevant facts in `state`; Jev can be confident even when facts are missing. Interpret scores using `legend`, and handle counting, arithmetic, and date comparisons in code. Questions are evaluated independently.

The context limit is 64k tokens for `state` and all questions together, and 32k for `state` plus the longest question.

## Image Generation

Generate images from text prompts via a simple GET request. Returns JPEG, PNG, or SVG depending on the selected model.

```
https://gen.pollinations.ai/image/a%20cat%20in%20space?model=flux
```

**Available models:** krea/krea-2-medium, lykon/dreamshaper-8-lcm, black-forest-labs/flux.1-kontext-pro, black-forest-labs/flux.1.1-pro, black-forest-labs/flux.2-pro, black-forest-labs/flux-3-image, black-forest-labs/flux.2-flex, black-forest-labs/flux.2-max, microsoft/mai-image-2.6-flash, microsoft/mai-image-2.6, google/gemini-2.5-flash-image, google/gemini-3.1-flash-image, google/gemini-3.1-flash-lite-image, google/gemini-nano-banana-2.1, google/gemini-3-pro-image, bytedance/seedream-5.0-lite, bytedance/seedream-5.0-flash, bytedance/seedream-5.0-pro, bytedance/seedream-4.0, bytedance/seedream-4.5, ideogram-ai/ideogram-v4-turbo, ideogram-ai/ideogram-v4-balanced, ideogram-ai/ideogram-v4-quality, openai/gpt-image-1-mini, openai/gpt-image-1.5, openai/gpt-image-2, openai/gpt-image-2.5-flare, openai/gpt-image-2.5-sunburst, black-forest-labs/flux.1-schnell, tongyi-mai/z-image-turbo, alibaba/wan-2.7-image, alibaba/wan-2.7-image-pro, qwen/qwen-image, qwen/qwen-image-2.1, qwen/qwen-image-3, x-ai/grok-imagine-image, x-ai/grok-imagine-image-quality, x-ai/grok-imagine-image-2.0, recraft/recraft-v4.1-vector, recraft/recraft-v4.1-flash, black-forest-labs/flux.2-klein-4b, prunaai/p-image, prunaai/p-image-edit, inferenceport-ai/lightning-image-turbo

### Community image models

Community image models use a `community/owner/model` id and support generation through `/image/{prompt}` and `/v1/images/generations`. The registration test adds image input and `/v1/images/edits` metadata when the registrant's edit endpoint succeeds. OpenAI-compatible responses default to `b64_json`; set `response_format: "url"` for a stored media URL. See `/image/models` for the live model list and supported endpoints.

## Video Generation

Generate videos from text prompts or reference images. Returns MP4.

```
https://gen.pollinations.ai/video/sunset%20timelapse?model=veo&duration=4
```

**Available models:** google/veo-3.1-fast, google/gemini-omni-1.1-flash, bytedance/seedance-1-pro-fast, bytedance/seedance-2.0, bytedance/seedance-2.0-mini, bytedance/seedance-2.0-fast, alibaba/wan-2.6, alibaba/wan-2.2-fast, alibaba/wan-2.7, alibaba/wan-3.0, x-ai/grok-imagine-video, x-ai/grok-imagine-video-1.5, x-ai/grok-imagine-video-1.5-lite, bytedance/seedance-2.5, alibaba/happyhorse-1.1, heygen/heygen-video-1, minimax/minimax-h3, minimax/minimax-h3-max, minimax/minimax-h3-max-turbo, prunaai/p-video

### Community video models

Community video models use a `community/owner/model` id and work on `/video/{prompt}`, `/image/{prompt}`, and `/v1/images/generations`. See `/video/models` for the live catalog and [Publish a Model](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_MODEL.md) for the synchronous publisher contract.

## Realtime

OpenAI-compatible Realtime WebSocket for voice, multimodal, and transcription sessions.

| Endpoint | Description |
|----------|-------------|
| `GET /realtime` | Pollinations Realtime session (`model=openai/gpt-realtime-2.1`) |
| `GET /v1/realtime` | WebSocket Realtime session (`model=openai/gpt-realtime-2.1`) |

Requires an API key with positive balance. Server clients can use `Authorization: Bearer <key>`; browser WebSocket clients can use `?key=pk_...`.

The WebSocket settles one billing event when the session closes. Selecting `elevenlabs/scribe-v2-realtime` creates a transcription session automatically; other realtime models create voice and multimodal sessions.

Events sent and received over both routes use the OpenAI Realtime protocol. See OpenAI's [Realtime WebSocket events guide](https://developers.openai.com/api/docs/guides/realtime-websocket#sending-and-receiving-events).

```js
import WebSocket from "ws";

// Server: Bearer auth. Browser: append `&key=pk_...` instead (headers aren't settable).
const ws = new WebSocket(
    "wss://gen.pollinations.ai/v1/realtime?model=openai/gpt-realtime-2.1",
    { headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } },
);

ws.on("open", () => ws.send(JSON.stringify({
    type: "session.update",
    session: { type: "realtime", instructions: "Be concise." },
})));
ws.on("message", (m) => console.log(JSON.parse(m.toString())));
```

**Browser audio:** play the model's audio through an `<audio>` element (e.g. a Web Audio `MediaStreamDestination` set as the element's `srcObject`), not straight to the Web Audio output. The browser only uses audio-element output as the echo-cancellation reference, so without it the mic re-captures the model's voice and it starts replying to itself. The WebRTC transport handles this automatically; on the WebSocket transport it's the client's responsibility.

**Realtime models:** openai/gpt-realtime-2.1, openai/gpt-realtime-2.1-mini, elevenlabs/scribe-v2-realtime, openai/gpt-live-transcribe

## 3D Generation

Generate 3D models from text prompts and images via a simple GET request.
Returns glTF Binary in GLB format by default. Depending on the model, certain
models ignore text inputs — any text prompt passed to the Trellis 2/Asset Harvester family will
be ignored; only the image URL is used.

https://gen.pollinations.ai/3d/no_prompt_for_trellis_needed?model=microsoft%2Ftrellis-2&resolution=low&key=YOUR_KEY_HERE&image=IMAGE_URL_HERE

**Available models:** microsoft/trellis-2, nvidia/asset-harvester, hyper3d/rodin-2.5

> **Note:** `hyper3d/rodin-2.5` and `nvidia/asset-harvester` require Paid Pollen. `microsoft/trellis-2` (the default)
> supports `low`, `medium`, and `high` resolution and works with Quest Pollen.

### NVIDIA Asset Harvester

`nvidia/asset-harvester` generates 3D Gaussian Splat
models in PLY format. Unlike other 3D models that return GLB, Asset Harvester
returns raw PLY binary suitable for real-time rendering in Gaussian Splat
viewers (e.g. SuperSplat, Three.js with Gaussian PLY loader).

## Audio Generation

Text-to-speech, music generation, and audio transcription.

| Endpoint | Description |
|----------|-------------|
| `GET /audio/{text}` | Simple URL-based TTS or music generation |
| `POST /v1/audio/speech` | OpenAI-compatible TTS |
| `POST /v1/audio/transcriptions` | Speech-to-text transcription |

**Audio models:** elevenlabs/eleven-v4, elevenlabs/eleven-v4-turbo, elevenlabs/eleven-v3, elevenlabs/eleven-flash-v2.5, elevenlabs/eleven-multilingual-v2, elevenlabs/eleven-v3:dialogue, elevenlabs/eleven-multilingual-sts-v2, elevenlabs/voice-isolator, elevenlabs/stem-separation, elevenlabs/music-v2, elevenlabs/music-v2.5, google/lyria-3.5, google/lyria-3-clip-preview, elevenlabs/eleven-text-to-sound-v2, openai/whisper-large-v3, openai/gpt-transcribe, elevenlabs/scribe-v2, x-ai/grok-transcribe, google/gemini-3.5-transcribe, x-ai/grok-tts, openai/tts-1, openai/tts-1-hd, google/gemini-3.8-flash-tts, google/gemini-3.8-flash-lite-tts, assemblyai/universal-2, assemblyai/universal-3.5-pro, stability-ai/stable-audio-3-medium, stability-ai/stable-audio-3, fish-audio/s2.1-pro, qwen/qwen3-tts-flash, qwen/qwen3-tts-instruct-flash, sesame/csm-1b, hexgrad/kokoro-82m

**Available voices:** alloy, echo, fable, onyx, nova, shimmer, ash, ballad, coral, sage, verse, rachel, domi, bella, elli, charlotte, dorothy, sarah, emily, lily, matilda, adam, antoni, arnold, josh, sam, daniel, charlie, james, fin, callum, liam, george, brian, bill

## Embeddings

Generate vector embeddings with an OpenAI-compatible response format.

| Endpoint | Description |
|----------|-------------|
| `POST /v1/embeddings` | OpenAI-compatible embeddings endpoint |
| `GET /embeddings/models` | Embedding models with pricing and modalities |

`google/gemini-embedding-2` supports text, image, audio, and video inputs. `cohere/embed-v4.0` supports text and one image per input. The OpenAI and Qwen embedding models are text-only.

String batch input supports up to 32 items. For retrieval, use `task_type` with Gemini text input (it is converted to the recommended prompt instruction) or `input_type` (`query` or `document`) with Cohere. Dimensions are model-specific: Cohere supports 256, 512, 1024, or 1536; `openai/text-embedding-3-small` supports up to 1536; `google/gemini-embedding-2` and `openai/text-embedding-3-large` support up to 3072; `qwen/qwen3-embedding-8b` supports up to 4096.

Gemini task instructions count toward prompt token usage. Cohere requests containing an image expose one combined usage count, so any accompanying text is billed at the image-input rate.

**Gemini GA migration:** `google/gemini-embedding-2` now uses the GA embedding space. Do not mix preview-era and GA vectors; re-embed stored `google/gemini-embedding-2` data before comparing it with new results.

**Embedding models:** google/gemini-embedding-2, openai/text-embedding-3-small, openai/text-embedding-3-large, cohere/embed-v4.0, cohere/embed-v4.0:azure:sweden, qwen/qwen3-embedding-8b, qwen/qwen3-embedding-8b:fireworks

## Community embedding endpoints

Owners can publish their own embedding backend as a community endpoint. A community embedding endpoint proxies `POST /v1/embeddings` to the owner's OpenAI-compatible upstream (`/embeddings` appended to the endpoint base URL) and is listed alongside the hosted models in `/embeddings/models` and `/v1/models`.

- **Input:** text (`input` as a string or array of strings, up to the embedding batch limit), with optional dimensions and float or base64 output encoding.
- **Billing:** community embedding models are token-only. `promptTextPrice` sets the price per input token, displayed as Pollen per 1M tokens, and billing uses the upstream `usage.prompt_tokens`. Usage is emitted through the standard `x-usage-*` headers.
- **Response:** the upstream returns an OpenAI embeddings object with positive `usage.prompt_tokens` and matching `total_tokens`.

## Models

Discover available models with pricing, capabilities, and metadata. No authentication required.

| Endpoint | Returns |
|----------|---------|
| `GET /models` | All models with pricing, capabilities, and metadata |
| `GET /v1/models` | All models in OpenAI-compatible format (`{object: "list", data: [...]}`) |
| `GET /text/models` | Text models with pricing, context window, tool support |
| `GET /image/models` | Image & video models with capabilities and pricing |
| `GET /video/models` | Video models with capabilities and pricing |
| `GET /audio/models` | Audio models with supported voices |
| `GET /embeddings/models` | Embedding models with supported modalities |
| `GET /3d/models` | 3D Generation models with supported modalities |

### Filters

All model list endpoints above accept the same optional `source` filter:
`official` or `community`. Omit it for both. `community=true|false|1|0`
remains available as a legacy source filter. The query overrides the
connection-wide header; `source` overrides `community`. Invalid values return
**400 Bad Request**. The filter combines with the caller's access restrictions;
it does not change generation permissions.

```bash
curl 'https://gen.pollinations.ai/v1/models?source=official'
```

To search or narrow a list instead of fetching the whole catalog, add any of:

| Parameter | Effect |
|-----------|--------|
| `query` | Case-insensitive search of the name, aliases, title, description and publisher; every word must match |
| `capabilities` | Comma-separated list (`tool_calling`, `reasoning`, `web_search`, `code_execution`, `pollinations_models`); a model needs all of them |
| `agent` | `true`/`1` for agents only, `false`/`0` to exclude agents |
| `limit` | At most this many models (1-500), in catalog order |

They apply after the access, source and reliability rules above, so `limit`
never counts a model the caller cannot see. Unknown capabilities and values
outside these ranges return **400 Bad Request**.

```bash
curl 'https://gen.pollinations.ai/text/models?query=gpt&capabilities=reasoning,tool_calling&limit=5'
```

OpenAI-compatible clients that append `/models` to their base URL can use the
equivalent header instead of the query parameter:

```text
Pollinations-Model-Source: official
```

This header works with Open WebUI and Cline custom OpenAI connections.
LibreChat administrators can set it in the custom endpoint's `headers` map.
The client can use any returned model ID for generation without forwarding the
catalog header.

Lists default to `reliability=reliable`: public community proxy models need more than
80% success across the last 50 eligible final requests within seven days.
Official models, agents, and owner-only private models are unaffected. There is no minimum sample size.
Models without observations remain listed. Successful fallbacks count as successes
for the requested model; final 4xx are excluded, while owner requests and
monitor probes count. Each entry includes `health` with `status`,
`success_rate` (null without observations), and `requests` (at most 50 for
community proxies). Other models keep their 24-hour health window. Health
refreshes roughly every 60 seconds; unavailable analytics fails open.

Use `?reliability=all` or `Pollinations-Model-Reliability: all` to see all
otherwise accessible models. The query takes precedence over the header.
This only affects discovery: exact-ID calls, retrieval and fallback routing
remain available. Authentication, key permissions, paid access and manual
hiding still apply. Owners can manage all their models in My Models.

Time-windowed traffic, latency and fallback breakdowns are served separately by
`/models/status`, described in [Public Stats](/docs#tag/public-stats).

Rich model endpoints include `capabilities` for agentic/model traits:
`tool_calling`, `reasoning`, `web_search`, and `code_execution`.
Modalities, video frame controls, voices, and context length remain separate
structured fields.

Use `supported_endpoints` to discover which public API routes accept each
model. `/v1/responses` identifies built-in models with a configured native
Responses route, community text models and endpoint agents whose owner supplied
the Responses API and one exact URL, and managed prompt agents. These community
models and agents also accept `/v1/chat/completions` through the shared adapter.
Built-in models may use separate upstream routes for Chat and Responses.
Supported media models also advertise both endpoints and return generated-file
links as assistant text. Reference-required models return their normal missing-input
error; use their native endpoint until attachments are supported here.

### Chat parameters

Official Chat models include `supported_parameters`: verified generation
controls honored through `/v1/chat/completions` on the model's primary route.

This field describes Pollinations' Chat behavior, not the native
`/v1/responses` API. Unverified controls are omitted; inclusion does not mean
every value or combination is supported. Provider fallback routes can have
different controls. Community models omit this field.
For example,
`openai/gpt-5.4` omits sampling controls because its Chat transform removes
them, while `openai/gpt-oss-20b` forwards `temperature` and `top_p`.
On `anthropic/claude-sonnet-4.6`, those two controls are mutually exclusive
(`temperature` wins), and both are disabled when `reasoning_effort` is enabled.
Newer Claude and Gemini models may omit sampling controls entirely. On
Sonnet 4.6, `response_format` supports `json_schema`, not `json_object`.
Reasoning effort levels and forced-tool restrictions remain model-specific.

## Community Models

Community models and agents use a canonical `community/owner/model` id and appear in the same discovery responses as Pollinations-operated models. Use `community=true` to return only community models or `community=false` to exclude them.

The old `owner/model` IDs remain generation aliases in each model's `aliases` array.

API key model permissions are model categories: `text`, `image`, `video`, `audio`, `3d`, `embedding` and `realtime`. A key allows every model in its categories, including models added later. Key creation and updates also accept model IDs, and each ID allows its whole category.

The `source=community` and `source=official` filters are equivalent source filters
for discovery. Source, access, and status filters combine with AND semantics.

For registration, publishing, pricing, fallbacks, and health monitoring, see [Publish a Model](/docs#tag/publish-a-model). For ownership endpoints and schemas, see [Community Models](/docs#tag/community-models) under Resources.

## Media Storage

Upload images, audio, and video and get back an id and URL. By default, each upload gets a new random id.

Base URL: https://media.pollinations.ai

Stored image, video, audio, and 3D files are linked through `Link: <https://media.pollinations.ai/{id}>; rel="enclosure"`. Image generation and editing preserve this header in both URL and base64 JSON responses; `response_format: "url"` also returns the URL in `data[].url`. Audio JSON responses, such as transcripts and timestamped speech, do not have a stored-file link. Fetching media URLs never triggers generation; missing files return 404. A generated file's ID identifies its request, so a new generation after expiry may replace the file at the same URL. Clients may continue using an older cached result after regeneration.

| Endpoint | Description |
|----------|-------------|
| `POST /upload` | Upload a file, receive a unique media URL |
| `GET /{id}` | Retrieve a previously uploaded file |
| `GET /{id}/metadata` | Get file metadata as JSON |
| `GET /media?tag={tag}` | List the public gallery for a tag (no auth) |
| `DELETE /media/{id}` | Delete a published item you own (secret `sk_` key) |

Upload requires an API key; retrieval is public. Multipart FormData and raw file uploads can reach 400 MiB through `media.pollinations.ai`. Base64 JSON uploads remain limited to 100 MiB because they buffer the file in Worker memory. Files use a 30-day lifecycle from upload or the latest refresh. Retrieving the file body refreshes that lifecycle only when the object is at least 15 days old; metadata and HEAD requests do not refresh it. Three upload formats are accepted:

Raw file body (streams to storage; returns a random, unlisted ID):

```bash
curl -X POST "https://media.pollinations.ai/upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: video/mp4" \
  -H "X-File-Name: video.mp4" \
  --data-binary @path/to/video.mp4
```

Multipart form (browsers, files on disk):

```bash
curl -X POST "https://media.pollinations.ai/upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F file=@path/to/image.png
```

Base64 JSON (programmatic callers that already hold the bytes):

```bash
curl -X POST "https://media.pollinations.ai/upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data": "<base64-or-data-uri>", "contentType": "image/png", "name": "image.png"}'
```

**Custom IDs.** Add `id` to either format (for example, `-F id=cover.png` or `"id": "cover.png"`). IDs are case-sensitive, start with a letter or digit, and contain up to 128 letters, digits, dots, underscores, or hyphens. A user-owned API key is required. The returned id includes an opaque account prefix; use the returned URL for retrieval. The same ID works independently for different accounts. Existing files or gallery entries return `409` without replacement, including on retries.

Untagged files cannot be deleted. They expire after 30 days, but reads refresh retention once a file is at least 15 days old. An ID can be reused only once its file and any gallery entry are gone. A failed upload can still leave its ID occupied, so a retry may return `409`. Custom-ID files are served with `Cache-Control: no-store`.

**Tags publish (alpha).** An optional `tags` field (comma-separated string, or a JSON array in the JSON format) publishes the upload into each tag's public gallery, where anyone can list it via `GET /media?tag={tag}`. Untagged uploads stay unlisted; all retrieval URLs are public, not access-controlled. Knowing one custom URL makes other predictable names in that account guessable. Full endpoint reference: https://media.pollinations.ai/openapi.json

## Account

Self-service endpoints for the authenticated user. Endpoints require authentication (API key or session) unless their schema says otherwise. API keys need the relevant `account:<scope>` permission. Base path: `/account`.

`account:usage` is the read-only account-state scope for balances, usage, quests, and earnings. `account:keys` manages keys and, where enabled, my-models. These permissions are independent; request both when a client needs both. Agent run tokens (`ag_`) carry the same account permissions as the key the agent was called with.

| Endpoint | Description |
|----------|-------------|
| `GET /account/profile` | GitHub username, image, and community model access |
| `GET /account/balance` | Current pollen balance |
| `GET /account/quests` | Read-only quest status |
| `GET /account/usage` | Per-request usage history with costs (account-wide) |
| `GET /account/usage/daily` | Daily aggregated usage for dashboards |
| `GET /account/key/usage` | Usage history for the calling API key only |
| `/account/agents` | Managed agent configuration |
| `/account/my-models` | Private community model registration and allowlisted public publishing |
| `GET /account/key` | API key validity, type, and permissions |

### GET /account/profile

Returns user profile. `githubUsername`, `image`, and `communityEndpointsAllowed` are always included. `name` and `email` are included only when the API key has `account:profile`.

### GET /account/balance

`balance` is the amount visible to this caller and is kept stable for existing clients:

- Budgeted API keys always get the key's remaining budget in `balance` (no extra scope).
- Sessions and unbudgeted keys get the account total (Quest Pollen + paid) in `balance`. That path requires `account:usage` for API keys.

When the caller can view account usage (dashboard session or `account:usage`), the response also includes `accountBalance: { total, tier, paid }` so clients can see Quest Pollen vs paid Pollen. Budgeted keys without `account:usage` do **not** receive `accountBalance` — that would leak the owner's wallet.

### GET /account/key/usage

Usage history for the API key used in the request. No extra scope — a key can always read its own usage. For account-wide usage across all keys, use `GET /account/usage` with `account:usage`.

### GET /account/quests

Returns the quest catalog with account status. `completed` includes both globally completed quests and quests earned by the account. Requires `account:usage`. Claiming rewards is dashboard-only.

### GET /account/usage

Per-request usage history: model, token counts, cost, response time. Requires `account:usage`.

### GET /account/usage/daily

Daily aggregated usage suitable for dashboards. Requires `account:usage`.

### GET /account/key

Returns the current API key's validity, type, and permissions.

### /account/agents

Create and manage managed agents and their callable `community/owner/name` model listings. Private agents are available to any account with linked GitHub; public listing requires community publisher access. Managed agents are text-only and free at the outer layer; their model and tool calls consume the caller's Pollen.

- **Prompt agent**: instructions, a base model, and optional MCP servers.
- **Code agent**: a public GitHub repository with `agent.ts` at its root. Pollinations deploys the current default-branch revision; the repository name becomes the model ID and title. The bundled Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`) is importable; other dependencies are not installed. The callback receives `model(id)`, `mcp.tools(server)`, `respond(config)`, `pollinations(path, init)`, `mcp.listTools(server)`, and `mcp(server, tool, arguments)`.

`POST /account/agents/{id}/sync` redeploys a code agent's latest revision and bundled runtime. It needs no authentication, is limited to once every 30 seconds, and cannot change the stored repository. To deploy after every push, add a GitHub Action step (replace `AGENT_ID`):

```yaml
- run: curl --fail --retry 2 --retry-delay 30 -X POST https://gen.pollinations.ai/account/agents/AGENT_ID/sync
```

See [Publish an Agent](/docs#tag/publish-an-agent) for dashboard, CLI, and API examples, or [fork a code agent example](https://github.com/orgs/pollinations/repositories?q=topic%3Apollinations-code-agent-example) to get started.

### /account/my-models

Community text, image, video, speech-to-text, and text-to-speech model management. Any authenticated account can list, create, update, delete, and call its private owner-only models. Text providers and endpoint agents declare one `api` (`chat_completions` or `responses`) and its exact `url`. Responses listings support both public text APIs through Gen; Chat Completions listings support Chat Completions only. Managed prompt agents use the local Responses runtime and require no endpoint URL. The text endpoint test checks JSON and streaming usage for the selected API; `/models` discovery is optional.

Other model families retain `baseUrl`. Image providers expose `/v1/images/generations` and may also expose `/v1/images/edits`; transcription providers expose `/v1/audio/transcriptions`; speech providers expose `/v1/audio/speech` and must return binary audio, which is billed by input character count. Video providers enter an exact endpoint URL that accepts `prompt`, optional `duration`, and optional `image` and `reference_*` URL arrays. Omitted duration uses the provider's default. Return completed MP4 media as `data[].b64_json` or `data[].url`, plus `usage.duration` in generated seconds. Billing uses reported duration, falling back to requested duration when usage is missing; at least one is required. The endpoint test detects image-edit support and selects image pricing: valid OpenAI image token usage enables per-1M-token pricing, otherwise a fixed Pollen price is charged once per successful generated image.

Public publishing requires `communityEndpointsAllowed: true`; [request account-level publisher access](https://github.com/pollinations/pollinations/issues/new?template=community-model-allowlist.yml) with the allowlist form. Inspecting and testing an upstream endpoint is open to every account, limited to one probe every 30 seconds. The form does not register individual models. API keys require `account:keys`. The dashboard, Account API, and `polli my-models` support text, image, video, transcription, and speech registration. See [Publish a Model](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_MODEL.md) for setup, publishing, pricing, fallbacks, and health monitoring.

## Safety

Optional safety checking runs on text input before generation. Omitted, `false`, or `0` means off.

For community models, enabled checks run before text is sent to the provider or a configured fallback.

Models may require specific checks. Required checks are listed as `required_safety` in the model catalog and cannot be disabled by callers.

Use `safe` as a query parameter or JSON body field, or send the same value in the `Pollinations-Safe` header.

Values: `privacy` redacts personal information like names, email, phone, address, IP, URLs, and usernames. `secrets` redacts keys and passwords. `sexual`, `violence`, and `shield` block matching requests. Aliases: `true` = `privacy,secrets`, `nsfw` = `sexual,violence`.

```bash
curl "https://gen.pollinations.ai/text/email%20me%20at%20a%40example.com?safe=privacy" \
  -H "Authorization: Bearer YOUR_API_KEY"

curl https://gen.pollinations.ai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Pollinations-Safe: privacy" \
  -d '{"model":"openai/gpt-5.4-nano","messages":[{"role":"user","content":"email me at a@example.com"}]}'
```

Large requests check the latest 50,000 text characters, across up to 25 text parts, in one safety call.

Blocked requests return `400` with `error.code: "content_blocked"`; the message names the triggered categories. Safety service failures return `503`. Check `X-Safety-Applied`, `X-Safety-Redacted`, and `X-Safety-Status` headers.

## Errors

All errors return JSON with a consistent shape:

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Description of what went wrong"
  }
}
```

| Status | Meaning |
|--------|---------|
| `400` | Invalid parameters or malformed request |
| `401` | Missing or invalid API key |
| `402` | Insufficient pollen balance |
| `403` | API key lacks required permission |
| `500` | Internal server error |

### Timeouts and retries

If your client or proxy times out, send the exact same request again. Keep the endpoint, body, query parameters, and seed unchanged.

The generation continues after the connection closes. The retry waits for the generation already in progress or receives the completed cached result, instead of starting another generation. Only the generation is billed; retries and cache hits are not.

This applies to cache-backed, non-streaming text, embedding, image, video, 3D, audio, and transcription requests, including the OpenAI-compatible endpoints. Streaming text and uncached endpoints run independently.

## Public Stats

Anonymous, read-only platform statistics served directly from Tinybird. No
account or API key needed — pass the shared public read token as a query param.

Base URL: `https://api.europe-west2.gcp.tinybird.co`

Public read token (safe to embed client-side):

```
p.eyJ1IjogImFjYTYzZjc5LThjNTYtNDhlNC05NWJjLWEyYmFjMTY0NmJkMyIsICJpZCI6ICI5ZWZmMGM3Ni1kOTZkLTQwYjgtYWQwOC1mNDFlMmRiYjBmYTIiLCAiaG9zdCI6ICJnY3AtZXVyb3BlLXdlc3QyIn0.6VnVkAQ5h_fkcDZVDUoU38dzTxaw0xo3DnmKkhECbA8
```

| Endpoint | Params | Returns |
|----------|--------|---------|
| `GET /v0/pipes/public_model_stats.json` | `limit` (50) | Per-model usage over seven days, refreshed hourly: request count, typical (median) cost, avg response time |
| `GET https://gen.pollinations.ai/models/status` | `minutes` (60, max 10080) | Per-model and per-route health in a recent window: 2xx/4xx/5xx counts, fallback rescues, latency p50/p95. A 60-second edge cache in front of the `model_route_health` pipe; prefer it over calling Tinybird directly. |
| `GET /v0/pipes/weekly_health_stats.json` | `weeks_back` (12) | Weekly service availability (`2xx / (2xx + 5xx)`, cache excluded) and latency |
| `GET /v0/pipes/app_top_weekly.json` | `limit` (10) | Listed apps ranked by successful, billable BYOP requests over the rolling last 7 days. Credits each registered App Key to the owner's catalog listing whose URL covers its redirect URI, or to the owner's only listing; excludes failed/unbilled requests and banned users. Returns catalog `app_url`, `app_name`, `owner`, `request_count`, and `last_seen` |
| `GET /v0/pipes/app_directory_public.json` | `category`, `platform`, `limit` (1000) | The community app directory ([app.json](https://github.com/pollinations/pollinations/blob/main/operations/app-management/app.json)) |

Tinybird responses are JSON: a `data` array of rows plus a `meta` array typing
each column. Append `&token=<public-read-token>` to authenticate them. The
model status gateway has the same response shape and does not require the
Tinybird token.

```bash
curl "https://api.europe-west2.gcp.tinybird.co/v0/pipes/public_model_stats.json?limit=5&token=PUBLIC_READ_TOKEN"
```

## Connect User Wallets

Connect User Wallets—also called BYOP (Bring Your Own Pollen)—lets your users authorize your app to spend their own Pollen on Pollinations requests. Your publishable App Key (`pk_...`) identifies the app; after approval, Pollinations returns a scoped user key (`sk_...`) for API calls.

Users stay in control of their balance, budgets, and revocation; your app never has to pay for their usage.

## 🗝️ App Key

An **App Key** (`pk_...`) is the publishable key your app sends users to Pollinations with. Without one, the consent screen falls back to the redirect hostname and traffic isn't attributed to your account.

To create one, go to [enter.pollinations.ai](https://enter.pollinations.ai/keys) → **Create New App Key**:

<p align="left"><img src="https://media.pollinations.ai/28716f8fb8677eff" alt="Edit App Key" width="420"></p>

Set the **Name** (shows on the consent screen). For web apps, add at least one **Redirect URI** (your exact callback URL). The key you get back is your `client_id` (a `pk_...` publishable key; the legacy name `app_key` is still accepted).

When a user lands on the consent screen signed-out, they're prompted to continue with GitHub:

<p align="left"><img src="https://media.pollinations.ai/f9fd70e72156ddec" alt="Authorize — signed out" width="420"></p>

Once signed in, they review the requested access and confirm:

<p align="left"><img src="https://media.pollinations.ai/2ab9b5e0a2408e93" alt="Authorize — signed in" width="420"></p>

## Developer Earnings

Developer earnings are opt-in per App Key. When enabled, users pay 25% over base rates. The markup credits to your balance.

```text
Base request cost: 1.00 pollen
User pays:         1.25 pollen
You receive:       0.25 pollen
```

Credits land in the same balance type the user paid from: Quest Pollen when the request used Quest Pollen, Paid Pollen when it used Paid Pollen.

Pass `earningsEnabled: true` when creating an App Key via the API, or toggle it later from the dashboard:

```bash
curl -X POST https://gen.pollinations.ai/account/keys \
  -H 'Authorization: Bearer sk_yoursecretkey' \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-app","type":"publishable","redirectUris":["https://myapp.com/callback"],"earningsEnabled":true}'
```

## ⚙️ Web Apps (OAuth Code Flow)

Use the OAuth authorization-code flow with PKCE for new web integrations. It keeps the `sk_...` key out of the browser callback URL and works with standard OAuth clients.

Discovery is available at:

```text
https://enter.pollinations.ai/.well-known/oauth-authorization-server
```

### 1. Build the Auth Link

Generate a fresh PKCE verifier and S256 challenge, then send the user to `/authorize`:

```text
https://enter.pollinations.ai/authorize
  ?response_type=code
  &client_id=pk_yourkey
  &redirect_uri=https://myapp.com/callback
  &scope=profile%20usage
  &state=random-csrf-token
  &code_challenge=BASE64URL_SHA256_VERIFIER
  &code_challenge_method=S256
```

With restrictions:
```text
https://enter.pollinations.ai/authorize?response_type=code&redirect_uri=https://myapp.com/callback&client_id=pk_yourkey&scope=usage&models=black-forest-labs/flux.1-schnell,openai/gpt-5.4-nano&expiry=7&budget=10&state=random&code_challenge=...&code_challenge_method=S256
```

| Param | What it does | Example |
|-------|-------------|---------|
| `client_id` | Your publishable key — shows app name + author on consent screen, tracks traffic and developer earnings | `pk_abc123` |
| `redirect_uri` | Where users return after authorizing — must exactly match a Redirect URI on the App Key, query string included (loopback `http://localhost` matches any port) | `https://myapp.com/callback` |
| `response_type` | Use `code` for the OAuth authorization-code flow | `code` |
| `state` | Opaque value echoed back on the callback for CSRF protection | `any-random-string` |
| `code_challenge` | Base64url SHA-256 of your PKCE verifier | `abc...` |
| `code_challenge_method` | Must be `S256` | `S256` |
| `scope` | Account access (space or comma separated) | `usage keys` |
| `models` | Restrict to specific models | `black-forest-labs/flux.1-schnell,openai/gpt-5.4-nano,openai/gpt-image-1-mini` |
| `budget` | Numeric Pollen cap. Defaults to `5`; users can clear the budget field on the consent screen for unlimited. | `10` |
| `expiry` | User-authorized key lifetime in days (default: 7) | `7` |

Legacy names `app_key`, `redirect_url`, and `permissions` are still accepted for backwards compatibility.

### 2. Handle the Redirect

User comes back with a short-lived code:

```text
https://myapp.com/callback?code=oauth_code&state=random-csrf-token
```

Validate `state`, then exchange the code at the token endpoint. Server-backed apps
call it from their backend; static browser apps can call it directly, because PKCE
replaces the client secret:

```bash
curl -X POST https://enter.pollinations.ai/api/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code' \
  -d 'code=oauth_code' \
  -d 'client_id=pk_yourkey' \
  -d 'redirect_uri=https://myapp.com/callback' \
  -d 'code_verifier=YOUR_PKCE_VERIFIER'
# → { "access_token": "sk_...", "token_type": "bearer", "expires_in": 604800, "scope": "profile usage" }
```

The authorization code is single-use and expires after 10 minutes. Token responses use RFC 6749 error objects such as `invalid_grant`, `invalid_request`, and `unsupported_grant_type`.

Scopes: `profile` (name + email), `usage` (account balance + usage), `keys` (account admin — create/list/revoke keys). The response's `scope` echoes what the user actually granted, which may be narrower than requested. Generation needs no scope — spending is bounded by the budget and expiry the user approved. There are no refresh tokens; re-run the flow when the key expires. Issued keys appear in the user's dashboard like any other API key and can be edited or revoked there at any time — revocation is immediate.

**Browser-only apps.** The same request works from `fetch`:

```javascript
const res = await fetch('https://enter.pollinations.ai/api/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,                                        // From the callback URL
    client_id: 'pk_yourkey',
    redirect_uri: 'https://myapp.com/callback',  // Exact registered URI
    code_verifier,                               // The verifier you saved
  }),
});
const { access_token } = await res.json();
```

Keep the token in memory, or `sessionStorage` if a callback page must hand it back within the same tab. Never put it in `localStorage`, a URL, analytics, or logs.

### 3. Call Pollinations

Use the returned `access_token` as the API key:

```javascript
fetch('https://gen.pollinations.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'openai/gpt-5.4-nano', messages: [{ role: 'user', content: 'yo' }] })
});
```

Examples: [browser-only](https://github.com/pollinations/pollinations/tree/main/apps/oauth-client-demo) ·
[existing user database](https://github.com/pollinations/pollinations/tree/main/apps/oauth-account-linking-demo)

## ⚙️ Legacy Web Apps (Fragment Flow)

The older BYOP redirect flow is still supported. It returns the user-authorized key directly in the URL fragment and does not use PKCE.

```text
https://enter.pollinations.ai/authorize?redirect_uri=https://myapp.com/callback&client_id=pk_yourkey&scope=usage
```

User comes back with the key in the URL fragment:

```text
https://myapp.com/callback#api_key=sk_abc123xyz
```

Fragment, not query param — never hits server logs. 🔒 If you passed `state`, it's echoed back: `#api_key=sk_...&state=...`. On denial the fragment is `#error=access_denied&state=...`.

### Code

```javascript
// Send user to auth
const params = new URLSearchParams({
  redirect_uri: location.href,
  client_id: 'pk_yourkey',
});
window.location.href = `https://enter.pollinations.ai/authorize?${params}`;

// Grab key from URL after redirect
const apiKey = new URLSearchParams(location.hash.slice(1)).get('api_key');

// Use their pollen
fetch('https://gen.pollinations.ai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'openai/gpt-5.4-nano', messages: [{ role: 'user', content: 'yo' }] })
});
```

## 🖥️ CLIs & Headless Apps (Device Flow)

Same authorize screen, but the user opens a browser separately. Your CLI polls for the key.

Use this for CLIs, bots, extensions, and other apps that cannot show the authorization page themselves.

```bash
# 1. request a device code (pass your app_key as client_id for attribution)
curl -X POST https://enter.pollinations.ai/api/device/code \
  -H 'Content-Type: application/json' \
  -d '{"client_id": "pk_yourkey"}'
# → { "device_code": "...", "user_code": "ABCD-1234",
#     "verification_uri": "https://enter.pollinations.ai/device",
#     "verification_uri_complete": "https://enter.pollinations.ai/device?user_code=ABCD-1234",
#     "expires_in": 1800, "interval": 5 }

# 2. give the user verification_uri_complete to open directly,
#    or show verification_uri and user_code

# 3. poll for the key (every 5s)
curl -X POST https://enter.pollinations.ai/api/device/token \
  -H 'Content-Type: application/json' \
  -d '{"device_code": "..."}'
# pending → { "error": "authorization_pending" }
# done    → { "access_token": "sk_...", "token_type": "bearer" }
```

The same device-code exchange is also available through the standard token endpoint:

```bash
curl -X POST https://enter.pollinations.ai/api/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=urn:ietf:params:oauth:grant-type:device_code' \
  -d 'device_code=...'
```

## 👤 Who's Using This Key?

Once you have the user-authorized `sk_...` key, you can check who it belongs to:

```bash
curl https://enter.pollinations.ai/api/device/userinfo \
  -H 'Authorization: Bearer sk_...'
# → { "sub": "user-id", "preferred_username": "voodoohop", "picture": "..." }
# with the `profile` scope, also: "name": "Thomas", "email": "..."
```

`/api/oauth/userinfo` returns the same standard OIDC userinfo shape. `name` and `email` are included only when the key carries the `profile` scope.

---

🕐 User-authorized keys default to 7 days. Users can revoke anytime from the dashboard.

[edit this doc](https://github.com/pollinations/pollinations/edit/main/BRING_YOUR_OWN_POLLEN.md) · *h/t [Puter.js](https://docs.puter.com/user-pays-model/) for the idea*

## Publish a Model

Publishing a model lets you connect an endpoint to Pollinations and call it through `gen.pollinations.ai` under an `community/owner/model` id. Pollinations handles authentication, Pollen billing, model discovery, and routing; the model continues to run on infrastructure you control.

Model publishing and [connecting user wallets](./BRING_YOUR_OWN_POLLEN.md) solve different problems. Model publishing supplies a model to the Pollinations catalog. The wallet flow lets users authorize an app to spend their own Pollen. An app can use either or both.

## Supported Models

| Model family | Required upstream endpoint | Pollinations endpoint |
|---|---|---|
| Text: Chat Completions | One exact Chat Completions endpoint URL | `POST /v1/chat/completions` |
| Text: Responses | One exact Responses endpoint URL | `POST /v1/responses` and `POST /v1/chat/completions` |
| Image | `POST /v1/images/generations` | `GET /image/{prompt}` or `POST /v1/images/generations` |
| Image editing | `POST /v1/images/edits` in addition to image generation | `POST /v1/images/edits` |
| Video | Exact endpoint URL entered at registration | `GET /video/{prompt}`, `GET /image/{prompt}`, or `POST /v1/images/generations` |
| Speech to text | `POST /v1/audio/transcriptions` | `POST /v1/audio/transcriptions` |
| Text to speech | `POST /v1/audio/speech` | `POST /v1/audio/speech` |
| Embeddings | `POST /v1/embeddings` | `POST /v1/embeddings` |

Image providers must return `b64_json`. During testing, Pollinations checks whether an image provider supports edits and whether it reports OpenAI image-token usage.

Video generation is synchronous. Pollinations calls the exact URL entered at registration. `duration` is optional; when omitted, your endpoint chooses its default:

```json
{
  "prompt": "A green sprout moving in the breeze",
  "duration": 4,
  "image": ["https://example.com/start.jpg", "https://example.com/end.jpg"],
  "reference_images": ["https://example.com/style.jpg"],
  "reference_videos": ["https://example.com/motion.mp4"],
  "reference_audios": ["https://example.com/audio.mp3"]
}
```

Only supplied fields are included. In `image`, the first URL is the start frame and the second is the end frame. The `reference_*` arrays are general guidance rather than frame controls. Publishers select the accepted image, video, and audio input types when registering the model; unsupported combinations should return an error.

Return one completed MP4 within 300 seconds as `b64_json` or a public `url`, with the generated duration in seconds in `usage.duration`:

```json
{
  "data": [
    {
      "url": "https://video-provider.example/output/clip.mp4"
    }
  ],
  "usage": { "duration": 4 }
}
```

Pollinations sends no upstream model id. Billing uses `usage.duration` when reported, otherwise the requested duration. Report a positive number of generated seconds to support requests without a duration. Invalid reported usage, or no duration from either source, fails the request. Inline and downloaded responses are limited to 20 MB. Do not return an async job id; polling must finish inside the publisher endpoint before it responds.

Text-to-speech is synchronous and OpenAI-shaped. Pollinations calls your `/v1/audio/speech` with `{ model, input, voice, response_format }` and streams the returned binary audio back to the caller with its content type preserved. Registration sends a short sample and accepts any non-empty `audio/*` response. Billing charges the input text by character against your per-1M completion-audio price. Voice cloning, speech-to-speech, and timestamps are out of scope.

Realtime and 3D endpoints cannot currently be registered through this workflow.

## Private and Public Models

Any signed-in user can register and call a private model. Private models are owner-only, do not appear in the public catalog, and are free at the Pollinations layer.

Publishing a model requires account-level community publisher access while community model publishing is in alpha. Submit a [publisher access request](https://github.com/pollinations/pollinations/issues/new?template=community-model-allowlist.yml); the request enables public publishing for the account but does not register a model for you.

Public models appear in the model catalog and can be called by other Pollinations users. Owners set public pricing:

- Text models use the token categories reported by the upstream endpoint.
- Image models use per-token pricing when the registration test finds valid OpenAI image usage; otherwise they use a fixed price per generated image.
- Video models are priced from reported generated seconds, falling back to the requested duration when usage is missing.
- Transcription models are priced from reported audio duration.
- Embedding models use the prompt-token count reported by the upstream endpoint.
- A zero price makes the public model free.

Owners receive 75% of the Pollen spent on their models. Paid and Quest Pollen earnings remain in their respective wallet buckets. Cash payouts are not currently available.

## Register in the Dashboard

1. Open [My Models](https://enter.pollinations.ai/my-models).
2. Choose **Add model**.
3. For text, choose **Chat Completions** or **Responses** and enter that API's exact endpoint URL, model id, and bearer token. Other model families use a base URL; video uses an exact generation URL.
4. Run the endpoint test before publishing. Model discovery is optional; Responses endpoints do not need `/models` or a Chat Completions endpoint.
5. Save the model as private, then call its `community/owner/model` id through the normal Pollinations endpoint.
6. If your account has publisher access, change visibility to public and set prices when it is ready for other users.

### Model names

Choose a short, stable slug for the model ID (`owner/slug`) and a clear title for the catalog. Keep details that may change, such as price, hosting provider, routing, or context size, out of the slug. Use the description to identify the upstream model or explain what a router or rebranded model does. For example, use `owner/llama-3.1-8b` with the title `Llama 3.1 8B` and the description `Direct proxy to Meta Llama 3.1 8B via Groq`, or `owner/fast-router` with the title `Fast Chat Router` and the description `Routes between Llama and Mistral based on latency`.

The upstream credential is used by Pollinations to proxy requests to your endpoint. Do not place it in a model name, description, public URL, or example.

## Register with the CLI

The CLI manages text, image, video, transcription, and embedding model registrations. Sign in, test the endpoint, then create the model:

```bash
npx @pollinations/cli auth login

npx @pollinations/cli my-models test \
  --modality image \
  --base-url https://api.example.com/v1 \
  --bearer-token "$UPSTREAM_API_KEY" \
  --model image-v1

npx @pollinations/cli my-models create \
  --name my-image \
  --title "My Image" \
  --modality image \
  --image-pricing request \
  --completion-image-price 0.01 \
  --input-modalities text,image \
  --base-url https://api.example.com/v1 \
  --bearer-token "$UPSTREAM_API_KEY" \
  --upstream-model image-v1
```

Use `polli my-models list`, `update`, and `delete` for the rest of the lifecycle. API keys used for model management require the `account:keys` permission.

Text models use `--api responses --url https://api.example.com/v1/responses` or `--api chat_completions --url https://api.example.com/v1/chat/completions` instead of `--base-url`. Supply both flags when changing an existing text target. The selected URL is used exactly, including query parameters. The text endpoint test checks JSON and streaming responses for valid usage.

Embedding models use `--modality embedding`. For example, `--prompt-text-price 0.000001` charges 1 Pollen per 1M input tokens.

## Publishing Controls

Public models support these owner controls in the dashboard or Account API:

- `paidOnly` restricts calls to Paid Pollen.
- `perUserRpm` limits each Pollinations user; `null` removes the limit.
- Text models can declare `advertised.contextLength` and the `tool_calling` or `reasoning` capabilities.
- The provider profile at `POST /account/my-models/provider` sets the public provider name and service URL shared by your models.
- Owners can make a model private without deleting it. Its prices and fallbacks are saved for later publication.

Token prices cannot exceed 50 Pollen per 1M tokens. Fixed image prices cannot exceed 0.25 Pollen per image, video prices cannot exceed 0.5 Pollen per generated second, and transcription prices cannot exceed 0.012 Pollen per minute. See the [Community Models API reference](https://gen.pollinations.ai/docs#tag/community-models) for the exact fields.

## Call Your Model

Use the generated `community/owner/model` id anywhere the corresponding Pollinations endpoint accepts a model:

```bash
curl https://gen.pollinations.ai/v1/chat/completions \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "community/owner/my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Authenticated model-list requests include your own private models. Public discovery endpoints accept `community=true` to return only community models.

Each text registration declares one upstream API with `{ "api": "responses" | "chat_completions", "url": "https://…" }`. A Responses model advertises both `/v1/responses` and `/v1/chat/completions` in `supported_endpoints`. Responses calls go to the registered URL; Chat Completions calls use that same upstream through Pollinations' stateless adapter. A Chat Completions registration advertises only Chat Completions. Both paths require valid terminal usage for billing; missing or malformed usage fails the request and produces no charge for that model request.

Endpoint agents also select one upstream API and exact URL. Managed prompt agents use Pollinations' Responses runtime and have no publisher-configured endpoint URL. Both kinds of agent use the outer request ID to group child model and tool calls: the outer wrapper is free, and each completed child operation is billed once even if a later step fails.

## Fallbacks and Health

Public and private community models can nominate up to three compatible community fallbacks. Fallbacks are tried in order and must use the same model family. They must not cost more than the primary model; image fallbacks must also match its pricing mode and support image input when the primary model does. A fallback cannot require Paid Pollen unless the primary model does too.

Public model lists show community proxies with more than 80% success across their last 50 eligible final requests within seven days. Fallback rescues, owner requests, and monitor probes count. Final 4xx are excluded. There is no minimum sample size, and models without recent data remain listed. Private models remain visible to their owners.

Models filtered for reliability still work by exact ID and can serve as fallbacks. Use `?reliability=all` on a model-list endpoint to include them. Private models remain owner-only; this option does not bypass access controls.

The monitor helps diagnose issues and selectively probes text/image models, normally no more than once every four hours with longer gaps after repeated failures. It no longer hides or relists models. Listing visibility updates automatically as new requests change the sample. View time-windowed diagnostics at [model-monitor.pollinations.ai](https://model-monitor.pollinations.ai).

## Trust Boundary

Community models run on the owner's infrastructure, not Pollinations infrastructure. Prompts, input media, and other request content are sent to that upstream provider. Do not send credentials or sensitive information to a community model unless you trust its owner and data handling.

For complete `/account/my-models` request and response schemas, use the [Community Models API reference](https://gen.pollinations.ai/docs#tag/community-models).

## Publish an Agent

Publishing an agent creates a reusable text model that Pollinations runs for you. A prompt agent combines instructions, a base model, and optional MCP tools. A code agent deploys one self-contained `agent.ts` file from a public GitHub repository.

This is different from hosting your own OpenAI-compatible model endpoint. It is also different from [connecting user wallets](./BRING_YOUR_OWN_POLLEN.md), which lets an app ask its users to pay for their own generations.

## Create an agent in the dashboard

1. Open [My Models](https://enter.pollinations.ai/my-models).
2. Add an agent and choose **Prompt agent** or **Code agent**.
3. Configure a prompt and base model, or enter a public GitHub repository.
4. Save it. The dashboard creates the agent configuration and registers its callable model name.

A linked GitHub username is required to create an agent. Private agents are visible and callable only by their owner. Public listings require [community publisher access](https://github.com/pollinations/pollinations/issues/new?template=community-model-allowlist.yml).

## Prompt agent configuration

An agent combines catalog fields with its runtime configuration:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Callable model name used in `<github-username>/<name>`. |
| `title` | Yes | Display title shown in the model catalog. |
| `description` | No | Catalog description. |
| `visibility` | No | `private` by default, or `public` with publisher access. |
| `systemPrompt` | Yes | Instructions for the agent, from 1 to 8,000 characters. |
| `baseModel` | Yes | A text model ID from [`GET /v1/models`](https://gen.pollinations.ai/v1/models). |
| `mcpServers` | No | Any of `pollinations`, `ffmpeg`, `exa`, `composio`, `computer`. Details: [`GET /mcp`](https://gen.pollinations.ai/mcp). |

Example `agent.json`:

```json
{
  "systemPrompt": "You are a concise research assistant. Cite the sources you use.",
  "baseModel": "openai",
  "mcpServers": ["pollinations"]
}
```

Updates replace the runtime configuration, so include `systemPrompt` and `baseModel`; include `mcpServers` if tools should remain enabled. You can also change the name, title, description, or visibility.

The `composio` server uses each caller's connections from **Account → MCP Connectors**. Public agents never receive or use the agent owner's app credentials.

### Tips

- `computer` gives each caller a private, persistent filesystem under `/workspace`. `/tmp` is emptied after every call, so keep memory files under `/workspace`.
- `computer` has one `bash` tool. Write literal commands, put file content in the tool's `stdin` field, and end each appended line with a newline. There is no nested `bash -c`.
- `computer` can also clone and push [collective memory](https://github.com/pollinations/collective-memory), a public repository shared by all agents. Give your agent a reason to leave something there for others to find: a game move, a post, an answer.
- Gen caches responses to identical requests. When testing memory or game state, change the wording of each test message.

## Code agent configuration

A code agent uses a public GitHub repository as its source of truth. Put one self-contained `agent.ts` at the repository root. Pollinations removes TypeScript syntax when deploying it; type errors do not block deployment, and plain JavaScript is valid in the same file. The repository name becomes the model ID and title, and its description becomes the catalog description. Repository visibility and agent visibility are independent: a private agent is owner-only even though its source repository is public.

The runtime bundles the actual Vercel AI SDK: `ai` version `7.0.66` and `@ai-sdk/openai-compatible` version `3.0.30`. Import their standard exports directly; repository `package.json` files and arbitrary npm dependencies are not installed.

```ts
import { stepCountIs } from "ai";

export default async function ({ model, respond, mcp }) {
    return respond({
        model: model("openai-fast"),
        instructions: "Answer the user, using tools when needed.",
        tools: await mcp.tools("pollinations"),
        stopWhen: stepCountIs(4),
    });
}
```

`model(id)` creates an SDK language model already connected to Pollinations; select IDs from [the model catalog](https://gen.pollinations.ai/v1/models). `respond(config)` runs the SDK tool loop and returns Responses JSON or SSE, including tool results and usage. It accepts SDK agent settings such as `instructions`, `tools`, and `stopWhen`, defaults to eight steps, and does not retry model requests. `mcp.tools(server)` provides executable SDK tools, limited to sixteen calls per request.

The callback also receives `request`, `pollinations(path, init)`, `mcp.listTools(server)`, and `mcp(server, tool, arguments)` for direct request and tool handling. It must return a `Response`; ordinary Worker APIs, including timers and streams, remain available. Platform model and MCP helpers use the caller's Pollen and permissions without exposing a reusable API key. `respond` does not emit the Vercel UI protocol or introduce a separate endpoint.

Example `code-agent.json`:

```json
{
  "type": "code_agent",
  "repository": "https://github.com/your-name/your-agent"
}
```

Create it with `npx @pollinations/cli agents create --config code-agent.json`. Add `--visibility public` to publish after your account has community publisher access. The API stores the GitHub-derived listing fields, repository, and deployed commit SHA—not the source code. The repository binding and model ID are fixed after creation; syncing refreshes the code, title, and description.

To deploy the newest default-branch revision after a push, add this step to a GitHub Action (replace `AGENT_ID`):

```yaml
- run: curl --fail --retry 2 --retry-delay 30 -X POST https://gen.pollinations.ai/account/agents/AGENT_ID/sync
```

The sync route needs no secret and cannot change which repository is deployed. It redeploys the current commit with the latest bundled runtime even when the source is unchanged, and is limited to once every 30 seconds.

## Code agent examples

Fork an example, then enter **your fork's URL** when creating a code agent in the dashboard. Each example is a separate repository with `agent.ts` at its root:

- [MCP tool loop](https://github.com/pollinations/pollinations-code-agent-example) — a model that can call Pollinations MCP tools using the AI SDK.
- [Model router](https://github.com/pollinations/pollinations-router-agent) — selects a model for each request and forwards the conversation unchanged.
- [Streaming timer](https://github.com/pollinations/pollinations-timer-agent) — streams a countdown without calling an AI model.

[Browse the example repositories](https://github.com/orgs/pollinations/repositories?q=topic%3Apollinations-code-agent-example).

Edit `agent.ts` in your fork to customize it. For automatic sync after a push, enable GitHub Actions and set the repository variable `POLLINATIONS_SYNC_URL` to `https://gen.pollinations.ai/account/agents/YOUR_AGENT_ID/sync` (use `https://staging.gen.pollinations.ai` for staging). Without the variable, the example workflows skip deployment.

## Create with the CLI

Create a prompt agent and its callable model listing in one command:

```bash
npx @pollinations/cli agents create \
  --config agent.json \
  --name research-assistant \
  --title "Research Assistant"
```

The callable model ID is `<your-github-username>/research-assistant`. Code agents derive their name, title, and description from GitHub; these cannot be overridden through either management API. An empty `description` is accepted and ignored. Add `--visibility public` to publish after your account has community publisher access. Managed agents are always text-only and free: they cannot set prices, fallbacks, or a per-user request limit.

## Call an agent

Once registered, call the agent exactly like any other text model:

```bash
curl https://gen.pollinations.ai/v1/chat/completions \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-github-username/research-assistant",
    "messages": [{"role": "user", "content": "Summarize this topic."}]
  }'
```

Managed agents also expose the stateless Responses API:

```bash
curl https://gen.pollinations.ai/v1/responses \
  -H "Authorization: Bearer $POLLINATIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-github-username/research-assistant",
    "input": "Summarize this topic.",
    "store": false
  }'
```

Responses requests run the same configured prompt and MCP tools as Chat Completions. They do not store response state, and caller-supplied tools are not added to a managed agent. Streaming emits Responses API events, a terminal response event containing usage, and one `data: [DONE]` marker.

The agent listing itself has no owner-set price. The caller still pays for the selected base model and MCP usage at the rates shown in the catalog. The catalog presents the base model's pricing and capabilities, plus the capabilities enabled by the agent's tools.

## Manage the lifecycle

```bash
npx @pollinations/cli agents list
npx @pollinations/cli agents get <agent-id>
npx @pollinations/cli agents update <agent-id> --config agent.json
npx @pollinations/cli agents sync <agent-id>
npx @pollinations/cli agents delete <agent-id>
```

Deleting an agent also deletes its model listing. Prompt-agent updates can change its runtime configuration and listing. Code-agent updates can change visibility and safety policy; `sync` deploys new code and refreshes GitHub metadata.

The Account API exposes the same operations under `/account/agents`. API keys need the `account:keys` permission. See the [Community Agents API reference](https://gen.pollinations.ai/docs#tag/community-agents) for request and response schemas.

## CLI

The Pollinations CLI — for humans, AI agents, and everything in between.

Generate text, images, audio, video from the terminal. Backed by the [Pollinations API](https://gen.pollinations.ai).

## First result

```bash
npm install -g @pollinations/cli
polli auth login
polli gen text "Say hello in one sentence" --model openai/gpt-5.4-nano
```

Device login opens a browser for approval. The last command prints a short, low-cost result in your terminal. To try an image next, run `polli gen image "a cat in space" --output cat.png` and check that `cat.png` was saved.

<video src="https://github.com/user-attachments/assets/c3ff5c45-672c-4c45-9027-7743d32f9785" controls muted loop playsinline width="720">
  <a href="https://github.com/user-attachments/assets/c3ff5c45-672c-4c45-9027-7743d32f9785">▶️ Watch the demo</a>
</video>

## For AI agents

Point your coding agent (Claude Code, Cursor, Windsurf, Codex) at the skill file and it gets the full usage map — flags, stdin conventions, `--json` output shape, error codes, the lot:

> Read https://raw.githubusercontent.com/pollinations/pollinations/main/packages/polli-cli/SKILL.md and follow the instructions to generate media with the `polli` CLI.

The skill also ships inside the package: `node_modules/@pollinations/cli/SKILL.md`.

Every command is agent-friendly:

- `--json` — structured stdout, human messages to stderr. Safe to parse.
- Exit code `0` on success, non-zero on error.
- A 402 error links to your balance, Quests, and top-up options.
- `polli auth status --json` (or `polli whoami --json`) exposes everything about the current session.

## Other ways to start

```bash
printf '%s' "$POLLINATIONS_API_KEY" | polli auth login --with-token
```

Credentials land at `~/.pollinations/credentials.json`. For one-off runs pass `--key sk_...`. Get keys at [enter.pollinations.ai](https://enter.pollinations.ai/keys).

Set `POLLINATIONS_ENV=staging` to use the staging API, with a separate login stored in `~/.pollinations/credentials.staging.json`. `polli upload` has no staging.

```bash
polli update    # npm install -g @pollinations/cli@latest, if installed globally
```

For npx or a local/project install, `update` prints instructions instead of creating a second global install.

Interactive commands show an occasional update notice without waiting for the network. Set `NO_UPDATE_NOTIFIER=1` to disable it. Notices are skipped for scripts, pipes, and `--json`; updates are never installed automatically. Updating leaves credentials and harness settings untouched.

## Generate

```bash
polli gen text "Explain quantum tunneling in one sentence"
polli gen text "Summarize this" < notes.md          # stdin becomes context
echo "context" | polli gen text "question"

polli gen image "cyberpunk city at night" --model flux --output city.png
polli gen image "enhance this" --image https://media.pollinations.ai/abc --model gptimage

polli gen audio "Hello world" --voice nova --output speech.mp3
polli gen audio "read it to me" --play                # plays back after saving (blocks until done)
polli gen audio "Hello world" --timestamps            # also saves speech.mp3.json with character timings
polli gen video "a waterfall in slow motion" --duration 5 --output clip.mp4
polli gen 3d "a red fox" --output fox.glb
polli gen 3d --image https://media.pollinations.ai/abc --resolution high
polli gen embeddings "first text" "second text"        # one vector per line
polli gen voice-change talk.mp3 --voice nova
polli gen isolate interview.mp4                        # strip music/noise, keep speech
polli gen transcribe speech.mp3

polli gen chat --model openai                         # interactive multi-turn
```

`gen text` streams by default. File-output commands pick a sensible default path if `--output` is omitted.

## Discover

```bash
polli models                 # all models
polli models --type image    # filter (text, image, audio, video, 3d, embedding)
polli models --stats         # health + perf (last 60m)
polli docs                   # full API reference in the terminal
polli docs /image            # one endpoint
polli docs --open            # open in browser
polli quests                 # public quest catalog
polli quests --claimed       # already-completed and earned quest status
```

## Account

Two kinds of keys:

- **Secret (`sk_`)** — backend use, full access. Default.
- **Publishable (`pk_`)** — safe to ship in frontend code.

```bash
polli keys list
polli keys create --name mybot --budget 100                    # secret (default)
polli keys create --name myapp --type publishable              # API publishable
polli keys create --name myapp --type publishable \            # 3rd-party app key
  --redirect-uri https://myapp.com/callback --earnings
polli keys revoke <id>
```

Keys can't be edited — to change a name, budget, or model list, revoke and recreate. Publishable app keys default developer earnings off; pass `--earnings` to enable them.

```bash
polli usage                  # pollen balance
polli usage --history        # recent requests
polli usage --daily          # daily spend
polli usage --daily --key polli-harness-claude --days 1   # what one harness key cost in the last day
polli earnings               # developer earnings (default 30 days, --days <n>)
polli quests --claimable     # only rewards ready to claim
polli agents list            # managed prompt agents
polli my-models list         # invite-only community text, image, and transcription models
```

Manage agents with API-shaped JSON config files:

```bash
polli agents get <id>
polli agents create --config agent.json --name my-agent --title "My Agent"
polli agents create --config code-agent.json
polli agents update <id> --config agent.json
polli agents delete <id>
```

`agent.json` contains the complete configuration:

```json
{
  "systemPrompt": "You are a concise research assistant.",
  "baseModel": "openai",
  "mcpServers": ["pollinations"]
}
```

Creating an agent also creates its callable model listing. See [Publish an Agent](https://github.com/pollinations/pollinations/blob/main/BUILD_YOUR_OWN_AGENT.md) for visibility, billing, and lifecycle details.

`polli auth login` creates a key with all account permissions Polli needs: `profile`, `usage`, `keys`, and `machines`. Use `account:usage` for narrow read-only account state like usage and quests. Use `account:keys` to manage keys and, where invite-only My Models access is enabled, my-models. Quest claiming remains in the dashboard.

## Coding harnesses

Point an agentic coding tool at Pollinations. `on` logs in if needed, mints a
key for the harness, backs up its config, and writes the provider; `off`
restores the backup.

The default is `openai/gpt-6-sol`; pass `--model <id>` to choose another model.
Bloom is key-only and keeps its own model selection.

```bash
polli harness --help              # supported harnesses
polli harness bloom on            # creates a dedicated key for Bloom CLI
polli harness dsh on              # DeepSeek Harness → Pollinations
polli harness dsh on --model moonshotai/kimi-k2.6
polli harness dsh on --no-mcp     # skip MCP tool configuration
polli harness hermes on           # adds the Pollinations provider + Polli skill to Hermes Agent
polli harness hermes on --model deepseek/deepseek-v4-flash
polli harness opencode on         # enables the Pollinations OpenCode plugin + default model
polli harness openclaw on         # adds the Pollinations provider + Polli skill to OpenClaw
polli harness pi on               # native provider, key, startup model, and Polli skill
polli harness prime on            # native Prime Agent provider support
polli harness tgpt on             # authenticated Pollinations text models in tgpt
polli harness <harness> status
polli harness <harness> off
```

Bloom stores its dedicated key in `$BLOOM_HOME/.env` (default `~/.bloom/.env`).
tgpt stores its provider, dedicated key, and model in `~/.config/tgpt/config.conf`.
The DSH adapter configures the Pollinations provider, hosted Pollinations MCP,
and Polli CLI skill globally under `$DSH_HOME` (default `~/.dsh`). Hermes Agent
stores its provider and skill under `$HERMES_HOME` (default `~/.hermes`, or
`%LOCALAPPDATA%\hermes` on Windows) and discovers the live Pollinations models;
install its hosted MCP servers with `polli mcp install hermes --all`. OpenCode uses
its official plugin; OpenClaw uses `openclaw.json`, while Pi and Prime Agent use
their native `models.json` provider support.
Pi 0.99+ also supports `polli mcp install pi --all` for native hosted MCP
servers. Run `/reload` in Pi afterward; remove them with `polli mcp remove pi`.
Model setup remains compatible with older Pi versions.

See [Coding Harnesses](https://github.com/pollinations/pollinations/blob/main/CODING_HARNESSES.md) for what each profile changes and how to add one.

## Sandboxes

Linux VMs from E2B, paid from your wallet (alpha).

```bash
polli sandbox create              # prints the id and sets up ssh
ssh <id>.polli                    # scp and rsync work too
polli sandbox timeout <id> 14400  # keep it running 4 hours without ssh
polli sandbox kill <id>
```

The default template comes logged in with the coding harnesses installed; the first interactive `ssh` connects them. See [Sandboxes](https://gen.pollinations.ai/docs#tag/sandboxes) for cost, limits, and using E2B's own CLI and SDKs.

## Links

- [gen.pollinations.ai](https://gen.pollinations.ai) — API
- [enter.pollinations.ai](https://enter.pollinations.ai) — dashboard, keys, billing
- [API docs](https://gen.pollinations.ai/docs)
- [Source](https://github.com/pollinations/pollinations/tree/main/packages/polli-cli)
- [Discord](https://discord.gg/pollinations-ai-885844321461485618)

## License

MIT

## Coding Harnesses

Use `polli harness` to connect a supported coding harness to Pollinations. It handles Polli login, a dedicated API key, model setup, and any Pollinations capabilities supported by that harness.

> **Available now:** Bloom CLI, Claude Code, Codex (through Codex Router), DeepSeek Harness, Hermes Agent, OpenCode, OpenClaw, Pi, Prime Agent, and tgpt are integrated `polli harness` profiles.

## Use a harness

Every integrated harness follows the same lifecycle:

```bash
polli harness --help
polli harness <harness> on
polli harness <harness> status
polli harness <harness> off
```

- `on` first checks that the harness can be launched, then connects it to Pollinations.
- `status` shows whether the harness is ready to use Pollinations.
- `off` removes only the Pollinations setup and preserves unrelated configuration.

If a harness cannot be launched, `on` stops before login, key creation, or configuration and shows its official installation command. If Polli is not installed yet, run the first setup through `npx @pollinations/cli@latest`. Login uses the browser device flow by default. Each harness receives its own API key instead of reusing the account key stored by `polli auth login`.

## Update a harness

Polli configures harnesses; it does not update their installations. Use the harness's updater (or the package manager you installed it with), then rerun `polli harness <harness> on` to refresh the model catalog and configuration.

```bash
npm install -g @pollinations/cli@latest
uv tool upgrade bloom-cli
claude update
# Codex Router: rerun its official installer/update flow
npx @deepseek-ai/dsh@latest web
hermes update
opencode upgrade
openclaw update
pi update self
prime-agent update
```

Current OpenClaw requires Node `>=24.16.0 <25` or `>=26.1.0`; Pi requires Node `>=22.19.0`. Upgrade Node before updating either harness if needed. Bloom requires Python 3.12 or newer. Stop a running DSH server before launching its replacement, and back up saved sessions before a major harness upgrade.

## Harnesses

Polli defaults to `openai/gpt-6-sol` unless you pass `--model <id>`. Bloom is key-only: Polli does not change Bloom's model selection.

| Harness | Status | What is unique |
| --- | --- | --- |
| [Bloom CLI](https://github.com/Ilm-Alan/bloom-cli) | **Available now** — `polli harness bloom on` | Creates a dedicated key for Bloom's existing Pollinations integration. |
| [Claude Code](https://claude.com/claude-code) | **Available now** — `polli harness claude-code on` | Writes a separate settings file for gen's Anthropic Messages API, leaving the native Claude login and settings alone; runs Claude Code itself for a `pong` smoke and verifies dedicated-key usage. |
| [Codex](https://github.com/openai/codex) + [Codex Router](https://github.com/duolahypercho/codex-router) | **Available now** — `polli harness codex on` | Uses Codex Router's generic-provider/curation path, protected credential storage and compatibility probe; native Codex ChatGPT login is left untouched. |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) | **Available now** — `polli harness dsh on` | Adds the Pollinations provider, hosted Pollinations MCP, and Polli skill. Uses `openai/gpt-6-sol` by default. Its official launch uses `npx`, so no separate global DSH installation is required. |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | **Available now** — `polli harness hermes on` | Adds the Pollinations provider, a dedicated key, and the Polli skill, discovering models from the live catalog. Install the hosted MCP servers with `polli mcp install hermes`. Defaults to `openai/gpt-6-sol`. |
| [OpenCode](https://opencode.ai) | **Available now** — `polli harness opencode on` | Uses the existing [Pollinations OpenCode plugin](https://github.com/fkom13/opencode-pollinations-plugin) for models, media tools, usage, and quests. Defaults to `openai/gpt-6-sol`. |
| [OpenClaw](https://github.com/openclaw/openclaw) | **Available now** — `polli harness openclaw on` | Adds the Pollinations provider, a dedicated key, and the Polli skill, pulling models from the live catalog. Defaults to `openai/gpt-6-sol`. |
| [Pi](https://github.com/earendil-works/pi) | **Available now** — `polli harness pi on` | Uses Pi's native provider support and the Polli skill. Add hosted MCP servers with `polli mcp install pi --all` (Pi 0.99+). Defaults to `openai/gpt-6-sol`. |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) | **Available now** — `polli harness prime on` | Uses native provider support and the Polli skill while preserving memories, sessions, and unrelated configuration. |
| [tgpt](https://github.com/aandrew-me/tgpt) | **Available now** — `polli harness tgpt on` | Configures tgpt's existing Pollinations provider with a dedicated key and authenticated text model. |

## Bloom CLI

```bash
uv tool install --python 3.12 bloom-cli
polli harness bloom on
bloom
```

Bloom already uses Pollinations for its models. `on` creates a dedicated key and stores it in `~/.bloom/.env` (or `$BLOOM_HOME/.env`); `off` restores the previous file or removes only that key if the file changed later.

## Claude Code

```bash
polli harness claude-code on
claude --settings ~/.pollinations/claude-code.json
polli harness claude-code status
polli harness claude-code off
```

Claude Code talks to gen's Anthropic Messages API (`/v1/messages`) directly. `on` writes `~/.pollinations/claude-code.json`, a Claude Code settings file whose `env` sets `ANTHROPIC_BASE_URL`, the dedicated key as `ANTHROPIC_AUTH_TOKEN`, and the model as `ANTHROPIC_MODEL` and every model alias (`haiku`, `sonnet`, `opus`, `fable`), so background requests and subagents also use Pollinations. Claude Code reads the file only when launched with `--settings`; plain `claude` keeps your native login and `~/.claude` settings.

Choose another model with `--model <id>`. Before `on` succeeds, Polli runs `claude -p --settings ~/.pollinations/claude-code.json` with a one-word `pong` prompt and confirms activity for the dedicated key; if that fails, the previous file is restored. `off` deletes only that file.

gen does not serve `/v1/messages/count_tokens`, so `/context` shows estimated counts. Claude Code warns that a Pollinations model id is not in its catalog and compacts at 200K tokens.

## Codex through Codex Router

```bash
# Install/update Codex Router using its official installer:
# https://github.com/duolahypercho/codex-router#install-everything-recommended
polli harness codex on
polli harness codex status
polli harness codex off
```

`on` requires Codex and Codex Router `>=0.6.0`. Polli drives Codex Router's generic-provider, protected-credential, model-curation, and compatibility-test paths rather than pointing Codex directly at Pollinations. It creates an owned `pollinations` provider, stores the dedicated child key in the router's protected credential store, and curates the selected live Pollinations model. Native Codex ChatGPT login and unrelated Codex/router configuration are preserved.

Choose the routed model with `--model <id>`. Before setup succeeds, Codex Router runs its compatibility smoke and Polli verifies dedicated-key activity. `status` reports client/router/provider/key/model readiness. `off` removes only Polli-owned provider, credential, and routed model state; it never removes Codex Router itself. Foreign provider state is never overwritten.

## tgpt

```bash
brew install tgpt # or use another official installation method
polli harness tgpt on
tgpt "Hello"
```

tgpt already includes a Pollinations provider. `on` selects it for text generation and writes a dedicated key and model to `~/.config/tgpt/config.conf`, making tgpt use the authenticated `gen.pollinations.ai` endpoint. Choose another model with `--model <id>`; `off` restores the previous file or removes only the Pollinations values if the file changed later.

The default model is `openai/gpt-6-sol`. Polli clears any generic `AI_API_KEY` from this file so it cannot override the dedicated `POLLINATIONS_API_KEY`; the original file is backed up. Exported environment variables, a local `config.conf`, or `--config` can override this user-level setup. `off` does not revoke the account key.

## DeepSeek Harness

```bash
npx @pollinations/cli@latest harness dsh on
polli harness dsh status
polli harness dsh off
```

DeepSeek Harness is officially run with `npx @deepseek-ai/dsh@latest web`. The explicit `@latest` selects the current release rather than a local installation. `on` verifies that `npx` is available before changing configuration. Choose another default model with `--model <id>`. Add `--no-mcp` if you do not want the hosted Pollinations media tools.

## Hermes Agent

```bash
npx @pollinations/cli@latest harness hermes on
polli harness hermes status
polli harness hermes off
```

`on` requires Hermes Agent to be installed with its official installer (`curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` on Linux/macOS/WSL, or `iex (irm https://hermes-agent.nousresearch.com/install.ps1)` on native Windows). It registers a `pollinations` provider in `$HERMES_HOME/config.yaml` (`~/.hermes/config.yaml`, or `%LOCALAPPDATA%\hermes\config.yaml` on native Windows), stores a dedicated key in `$HERMES_HOME/.env` as `POLLI_HERMES_API_KEY`, and installs the Polli skill under `skills/polli/`. Hermes discovers the current Pollinations models from the provider endpoint rather than a bundled list, so there is no second model catalog to keep in sync. Choose the default with `--model <id>` and switch later with `hermes model`. To add the hosted Pollinations MCP servers, run `polli mcp install hermes --all` (or pick server ids from `polli mcp list`). `off` restores the previous files byte-for-byte, or (if you edited them) removes only the Pollinations provider, key, and skill, leaving your other providers, fallbacks, memories, and skills untouched.

## OpenCode

```bash
npx @pollinations/cli@latest harness opencode on
polli harness opencode status
polli harness opencode off
```

`on` requires OpenCode to be installed (`curl -fsSL https://opencode.ai/install | bash`, `npm i -g opencode-ai`, or your package manager). It enables the existing [Pollinations OpenCode plugin](https://github.com/fkom13/opencode-pollinations-plugin) in `~/.config/opencode/opencode.json` (or `$OPENCODE_CONFIG` / `$OPENCODE_CONFIG_DIR`), stores a dedicated Pollinations API key in the plugin's own `config.json` (so no second login inside OpenCode is needed), and sets the default model to `pollinations/enter/openai/gpt-6-sol`. The plugin then serves the current Pollinations model catalog, media tools, usage, and `/poll quests` inside OpenCode. Choose another default with `--model <id>`; `off` removes only the plugin entry, the default model, and the stored key, leaving the rest of your OpenCode configuration untouched.

## OpenClaw

```bash
npx @pollinations/cli@latest harness openclaw on
polli harness openclaw status
polli harness openclaw off
```

`on` requires OpenClaw to be installed (`curl -fsSL https://openclaw.ai/install.sh | bash`, or `openclaw.ai/install`). For a fresh install, it first creates OpenClaw's baseline config and workspace. It then adds a `pollinations` provider under `models.providers` in `~/.openclaw/openclaw.json` (or `$OPENCLAW_CONFIG_PATH` / `$OPENCLAW_STATE_DIR` / `$OPENCLAW_HOME`), stores a dedicated Pollinations API key in `env.vars` and references it from the provider with OpenClaw's own `${VAR}` substitution, and sets the default model to `pollinations/openai/gpt-6-sol` in `agents.defaults.model.primary`. The model list is pulled live from the Pollinations catalog (`--model <id>` to choose a different default). The Polli skill is installed under `~/.openclaw/skills/polli/` so the agent can generate images, audio, and video. Choose another default with `--model <id>`; `off` restores the previous config byte-for-byte, or (if you edited it) removes only the Pollinations provider, the key, a `pollinations/*` default model, and the skill, leaving unrelated settings untouched.

## Pi

```bash
npx @pollinations/cli@latest harness pi on
polli harness pi status
polli harness pi off
```

`on` requires Pi to be installed with its official npm command: `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`. It registers the current compatible Pollinations model catalog in `~/.pi/agent/models.json`, stores a dedicated key in `auth.json`, selects the startup model in `settings.json`, and installs the Polli skill under `skills/polli/`. Choose another default with `--model <id>`. This setup works with Pi 1.0 and older versions without separate configuration formats.

Pi 0.99+ includes native MCP. Run `polli mcp install pi --all` (or choose servers from `polli mcp list`) to configure the hosted servers in `~/.pi/agent/mcp.json`. Both commands honor `PI_CODING_AGENT_DIR`. Run `/reload` in Pi after installation. MCP setup checks the Pi version before creating a key; upgrade older installations with `npm install -g --ignore-scripts @earendil-works/pi-coding-agent@latest`. MCP has its own lifecycle: `polli mcp status pi` and `polli mcp remove pi`; `polli harness pi off` leaves it unchanged.

## Prime Agent

```bash
npx @pollinations/cli@latest harness prime on
polli harness prime status
polli harness prime off
```

`on` requires Prime Agent to be installed with its official installer. It registers the current compatible Pollinations model catalog in `~/.prime/agent/models.json`, stores a dedicated key in `auth.json`, selects the startup model in `settings.json`, and installs the Polli skill under `skills/polli/`. Choose another default with `--model <id>`.

## MCP Servers

Use Pollinations-hosted MCP servers from any
[Model Context Protocol](https://modelcontextprotocol.io) client that supports
Streamable HTTP.

### Quick start

Get an API key from [enter.pollinations.ai](https://enter.pollinations.ai/keys),
then choose a server:

| Server | Endpoint | Use it for | Details |
| --- | --- | --- | --- |
| Pollinations | `https://gen.pollinations.ai/mcp/pollinations` | Discover and use models, generate text and media, create embeddings and 3D models, and inspect model status and account balance | [README](https://github.com/pollinations/pollinations/blob/main/packages/mcp/README.md) |
| Ask Jev | `https://gen.pollinations.ai/mcp/ask-jev` | Evaluate state with typed choice, score, and probability questions | [Source](https://github.com/pollinations/pollinations/tree/main/apps/ask-jev-mcp) |
| FFmpeg | `https://gen.pollinations.ai/mcp/ffmpeg` | Trim, convert, resize, compress, and remix audio and video | [Source](https://github.com/pollinations/pollinations/tree/main/apps/ffmpeg-mcp) |
| Exa Search | `https://gen.pollinations.ai/mcp/exa` | Search the live web and fetch clean page content | [Source](https://github.com/pollinations/pollinations/tree/main/apps/exa-mcp) |
| Connectors | `https://gen.pollinations.ai/mcp/composio` | Read Gmail, search GitHub, update Sheets, and post to Slack through Composio | [Source](https://github.com/pollinations/pollinations/tree/main/apps/composio-mcp) |
| Computer | `https://gen.pollinations.ai/mcp/computer` | Keep files and run bash in a private computer that persists between runs | [Source](https://github.com/pollinations/pollinations/tree/main/apps/computer-mcp) |

Send the key with every request:

```http
Authorization: Bearer YOUR_KEY
```

Get current endpoints and pricing from the live catalog:

```bash
curl https://gen.pollinations.ai/mcp
```

### Install into coding agents with the Polli CLI

The [Polli CLI](https://www.npmjs.com/package/@pollinations/cli) wires the
catalog into coding agents and IDEs for you. It fetches the live server list,
mints a dedicated API key per client, and merges the entries into the client's
config without touching your other MCP servers:

```bash
npx @pollinations/cli mcp list                  # live server catalog
npx @pollinations/cli mcp install cursor --all  # every server into Cursor
npx @pollinations/cli mcp install claude-code pollinations ffmpeg
npx @pollinations/cli mcp status                # what each client has
npx @pollinations/cli mcp remove cursor ffmpeg  # remove selected entries
npx @pollinations/cli mcp remove cursor         # remove all Pollinations entries
```

Supported clients: Claude Code, Codex CLI, VS Code, Cursor, OpenCode, Gemini
CLI, GitHub Copilot CLI, Windsurf, Cline, Amp, Kiro, Zed, Warp, Hermes Agent,
and Pi (0.99+).

Keys are stored locally in plaintext in client configs and reused on reinstall.
Codex instead references `POLLI_MCP_CODEX_API_KEY` in `~/.codex/.env`.
Files written by Polli use owner-only permissions on Unix. Do not share or commit
configs containing keys. Removal only deletes Pollinations entries; other servers
are left untouched.

### Use with hosted agents

Add MCP servers to an agent in
[My Models](https://enter.pollinations.ai/my-models).

### Connect a client

The official TypeScript client handles initialization and tool discovery:

```ts
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

const client = new Client({ name: "my-app", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(
  new URL("https://gen.pollinations.ai/mcp/pollinations"),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
      },
    },
  },
);

await client.connect(transport);
const { tools } = await client.listTools();
```

Other clients use the same endpoint and bearer header; only their configuration
format differs.

#### Claude Code

```bash
claude mcp add --transport http pollinations \
  https://gen.pollinations.ai/mcp/pollinations \
  --header "Authorization: Bearer YOUR_KEY"
```

Run `/mcp` in Claude Code to verify the connection. Replace the name and URL
with another endpoint from the table to use FFmpeg or Exa Search.

### Pollinations MCP

The Pollinations server exposes the main Pollinations API as agent-friendly
tools. Agents can discover live models, delegate text requests, generate and
edit media, create embeddings and 3D assets, transcribe audio, and inspect
model health, usage, earnings, quests, and API keys.

| Tool | Purpose |
| --- | --- |
| `listModels` | Search and list live models, aliases, capabilities, voices, endpoints, and pricing; narrow with `query`, `capabilities`, `agent`, `community`, `limit` |
| `getModelStatus` | Inspect recent requests, errors, and latency for a model |
| `generateText` | Generate text, use search-capable models, process multimodal input, or call a listed agent |
| `generateImage` | Generate or edit images |
| `generateVideo` | Generate video |
| `generateAudio` | Generate speech, music, or sound |
| `transcribeAudio` | Transcribe audio from a public HTTPS URL |
| `generate3D` | Generate a GLB 3D model |
| `createEmbeddings` | Create text or multimodal embeddings |
| `getBalance` | Check the remaining Pollen balance; requires `account:usage` permission |
| `getUsage` | List recent requests or a daily usage summary; requires `account:usage` permission |
| `getEarnings` | Show developer earnings from BYOP apps and community models; requires `account:usage` permission |
| `listQuests` | List quests with reward and claim state; requires `account:usage` permission |
| `listKeys` | List API keys; requires `account:keys` permission |
| `createKey` | Create a secret or publishable app key; requires `account:keys` permission |
| `revokeKey` | Revoke an API key by id; requires `account:keys` permission |

Use `listModels` before choosing a model or voice. The registry is live, so
clients should not rely on a hardcoded model list.

Generated media is uploaded unlisted to `media.pollinations.ai` and returned as
an MCP resource link, so binary data does not consume model context. Anyone
with the link can access it, and it expires after 30 days.

### Ask Jev MCP

`jev_decide` accepts `state` and a map of `questions`, each using `choice`,
`score`, or `noul` (probability). It returns typed answers with confidence or
probabilities. Include relevant facts in `state`; confidence can remain high
when facts are missing. Calls use Jev's listed model rate with no additional
MCP fee.

### FFmpeg MCP

`runFfmpeg` accepts public HTTPS media inputs and ordinary FFmpeg arguments. It
supports multiple inputs and returns the output as a hosted MCP resource link.
Pollinations saves sources as `input0`, `input1`, and so on. Reference those
exact names in arguments—for example, `["-i", "input0", "-vf",
"scale=1280:-2"]`—and omit the `ffmpeg` executable, source URLs, and output
path.

### Exa Search MCP

- `web_search_exa` searches the live web and returns relevant pages with
  highlights.
- `web_fetch_exa` reads one or more known URLs as clean text when the search
  highlights are not enough.

### Connectors MCP

The Connectors MCP uses Composio to discover and run tools in each user's own
accounts. Enable it in your agent or connect the MCP endpoint, then ask for a
specific task, such as “Summarize my unread Gmail” or “Find open issues in my
GitHub repository.”

When an app is not connected, the agent can return a sign-in link. You can also
[connect apps in your account](https://enter.pollinations.ai/account#connectors).
Sign-in links expire after 10 minutes; select Connect again for a fresh link.
Connecting an app does not automatically enable it in an agent.

### Computer MCP

The Computer server gives each account a private filesystem under `/workspace`
and a bash shell. Files persist between requests and agent runs; nothing runs
while idle. There is one tool, `bash`, with `command`, optional `stdin` (for
example file content for `cat > path`) and optional `cwd`, which defaults to `/workspace` and is created if
missing. The shell cannot run Node or Python; curl, coreutils,
`grep`, `sed`, `awk`, `jq`, `xan`, `html-to-markdown`, `file`, `tar`, and `git` are available. A `/workspace/README.md` is created on first use and
describes a simple memory layout (`memory/facts.md` plus a dated
`memory/log/`). Keep one folder per project. Nothing is shared between accounts. Files come in with `curl` or `git clone` and go out with `assets publish <path>`, which copies a file to
[media.pollinations.ai](https://media.pollinations.ai) and prints an unlisted URL that
expires after 30 days. Every call costs the same flat rate; see the catalog.

#### Collective memory

[Collective memory](https://github.com/pollinations/collective-memory) is a
public, permanent repository shared by all agents: clone it, read its README,
leave something for the next agent and push (no token needed). Never write
private data. [Browse it](https://memory.pollinations.ai).

### Billing and permissions

Calls use the same Pollen wallet as the Pollinations API. The catalog endpoint
shows each server's current pricing. Pollinations generation tools use the
selected model's listed rate. A `tools/call` on a server with its own rate
needs a positive Pollen balance and returns 402 otherwise; `initialize` and
`tools/list` stay free.

An MCP server can only use models and account features allowed by the caller's
key and cannot spend beyond that key's budget. Configure both in
[API key settings](https://enter.pollinations.ai/keys). See
[Authentication](https://gen.pollinations.ai/docs#tag/authentication) for key
types and security guidance.

## Sandboxes

Linux VMs from [E2B](https://e2b.dev), paid from your Pollinations wallet (alpha).

### Use a sandbox

```bash
polli sandbox create              # prints the id and sets up ssh
ssh <id>.polli                    # scp, sftp and rsync work too
polli sandbox list
polli sandbox timeout <id> 14400  # keep it running 4 hours without ssh
polli sandbox kill <id>
```

- A sandbox pauses about 10 minutes after the last ssh session ends. Your files stay, and the next `ssh` resumes it.
- To keep it running without ssh, pay for the time up front with `polli sandbox timeout <id> <seconds>`, up to 24 hours at a time. It also resumes a paused sandbox.
- The first `ssh` allows only polli's key, `~/.pollinations/ssh/id_ed25519`. On other templates than the default, it first installs `sshd`, `rsync` and `websocat` (Debian-based templates only).
- The default template, `pollinations` (2 vCPU, 2 GB), is E2B's `base` (Debian 12, Python 3.11) with Node.js 24, polli, and the coding harnesses polli connects: Claude Code, OpenCode, Pi, Hermes Agent and OpenClaw.
- It comes logged in when the key that creates it has the `keys` permission, as polli's own key does. polli inside uses a key of the sandbox's own, `polli-sandbox-<id>`, created like any other key, with polli's usual permissions. Killing the sandbox leaves the key. Your first interactive `ssh` connects each harness to Pollinations with a key of its own, `polli-harness-<harness>`.
- `polli sandbox create <template>` starts another E2B template instead, such as `claude` (Claude Code), `codex`, `opencode` or `amp` (2 vCPU, 2 GB each), or [any public one](https://docs.e2b.dev/use-cases/coding-agents). Bigger templates cost more per second.
- `polli sandbox logs <id>` shows the sandbox's system log: when it started and paused, and each process run in it.
- Needs Node.js 22 or newer.

### Cost and limits

- Billed at [E2B's per-second rates](https://e2b.dev/pricing) for the sandbox's CPU and memory, paid in advance: 10 minutes at creation, 10 minutes at a time while an ssh session is open, and the time you add with `polli sandbox timeout`.
- Unused time is not refunded. Pausing a sandbox early, or shortening its timeout, gives up the rest of its paid time; resuming pays again. To stop paying, let the paid time run out or kill the sandbox.
- A new sandbox needs enough balance, and enough key budget, for its first block; otherwise it is stopped with a 402.
- At most 3 sandboxes run at once per account.

### E2B SDKs

E2B's SDKs, and its CLI run directly, work unchanged. Use a Pollinations key with the `machines` permission:

```bash
export E2B_API_URL=https://gen.pollinations.ai/alpha/e2b
export E2B_API_KEY=sk_...
```

Run `polli sandbox ssh-config` once to ssh into the sandboxes they create. Auto-resume, snapshots, forks, IAM and volume mounts are not available.
