# Transform a Voice

- **Method:** `POST`
- **Path:** `/v1/audio/voice-changer`
- **Operation ID:** `postV1AudioVoiceChanger`
- **Tags:** Audio

Transform the speaker identity in an audio file while preserving its words, timing, emotion, and delivery. Accepts preset voice names or custom ElevenLabs voice IDs.

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `multipart/form-data`

- **`file` (required)**: `string`, format: `binary`

  Source audio, up to 50 MB. ElevenLabs supports clips up to five minutes. `audio` is accepted as an alias.
- **`model`**: `string`, default: `"elevenlabs/eleven-multilingual-sts-v2"`
- **`response_format`**: `string`, possible values: `"mp3", "opus", "aac", "wav", "pcm"`, default: `"mp3"`
- **`voice`**: `string`, default: `"alloy"`

  Target preset voice name or custom ElevenLabs voice ID.

**Example:**

```json
{
  "model": "elevenlabs/eleven-multilingual-sts-v2",
  "file": "@filename",
  "voice": "alloy",
  "response_format": "mp3"
}
```

## Responses

### 200 Success - Returns transformed speech

**Headers:**

- **`Link`**

  Public stored-file URL with rel="enclosure". Fetching it never generates media; expired files return 404. Also included when the file is wrapped in URL or base64 JSON.

  `string`

  **Example:**

  ```json
  "<https://media.pollinations.ai/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>; rel=\"enclosure\""
  ```

**Content type:** `audio/mpeg`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/opus`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/aac`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/wav`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/pcm`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Isolate Speech

- **Method:** `POST`
- **Path:** `/v1/audio/voice-isolator`
- **Operation ID:** `postV1AudioVoiceIsolator`
- **Tags:** Audio

Remove music, ambient sound, and other background noise from an audio or video file while preserving spoken audio.

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `multipart/form-data`

- **`file` (required)**: `string`, format: `binary`

  Source audio or video, up to 50 MB and at least 4.6 seconds long. `audio` is accepted as an alias.
- **`model`**: `string`, default: `"elevenlabs/voice-isolator"`

**Example:**

```json
{
  "model": "elevenlabs/voice-isolator",
  "file": "@filename"
}
```

## Responses

### 200 Success - Returns isolated speech as MP3 audio

**Headers:**

- **`Link`**

  Public stored-file URL with rel="enclosure". Fetching it never generates media; expired files return 404. Also included when the file is wrapped in URL or base64 JSON.

  `string`

  **Example:**

  ```json
  "<https://media.pollinations.ai/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>; rel=\"enclosure\""
  ```

**Content type:** `audio/mpeg`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Generate Audio (OpenAI-compatible)

- **Method:** `POST`
- **Path:** `/v1/audio/speech`
- **Operation ID:** `postV1AudioSpeech`
- **Tags:** Audio

Generate speech, music, sound effects, or dialogue from text. Compatible with the OpenAI TTS API for JSON requests.

Set `model` to `elevenlabs/music-v2`, `elevenlabs/music-v2.5`, `google/lyria-3-clip-preview`, `google/lyria-3.5`, `stability-ai/stable-audio-3-medium`, or `stability-ai/stable-audio-3` to generate music. Lyria Clip returns one fixed 30-second MP3 clip. For `google/lyria-3.5`, describe song structure and approximate length in the prompt; the output is MP3 and the `duration` parameter is not supported. Pass any publicly accessible audio URL as `reference_audio` to run audio-to-audio (style transfer) on `stability-ai/stable-audio-3-medium` or `stability-ai/stable-audio-3`, or reference-audio conditioning on either ElevenLabs Music model; for ElevenLabs inpainting, pass a `composition_plan`.

For multi-speaker audio, set `model` to `elevenlabs/eleven-v3:dialogue` and put one turn per line in `input` as `<voice>: <text>`. Voice labels may be preset names or ElevenLabs voice IDs; the top-level `voice` field is ignored for this model. Dialogue supports up to 10 unique voices and 2,000 total text characters.

**Available voices:** alloy, echo, fable, onyx, nova, shimmer, ash, ballad, coral, sage, verse, rachel, domi, bella, elli, charlotte, dorothy, sarah, emily, lily, matilda, adam, antoni, arnold, josh, sam, daniel, charlie, james, fin, callum, liam, george, brian, bill, conversational\_a, conversational\_b, read\_speech\_a, read\_speech\_b, read\_speech\_c, read\_speech\_d, af\_alloy, af\_aoede, af\_bella, af\_heart, af\_jessica, af\_kore, af\_nicole, af\_nova, af\_river, af\_sarah, af\_sky, am\_adam, am\_echo, am\_eric, am\_fenrir, am\_liam, am\_michael, am\_onyx, am\_puck, am\_santa, bf\_alice, bf\_emma, bf\_isabella, bf\_lily, bm\_daniel, bm\_fable, bm\_george, bm\_lewis, ef\_dora, em\_alex, em\_santa, ff\_siwis, hf\_alpha, hf\_beta, hm\_omega, hm\_psi, if\_sara, im\_nicola, jf\_alpha, jf\_gongitsune, jf\_nezumi, jf\_tebukuro, jm\_kumo, pf\_dora, pm\_alex, pm\_santa, zf\_xiaobei, zf\_xiaoni, zf\_xiaoxiao, zf\_xiaoyi, zm\_yunjian, zm\_yunxi, zm\_yunxia, zm\_yunyang, altair, ara, atlas, aurora, carina, castor, celeste, cosmo, eve, helios, helix, iris, kepler, leo, liora, lumen, luna, lux, naksh, orion, perseus, rex, rigel, sal, sirius, ursa, zagan, zenith, Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat

**Output formats:** mp3 (default), opus, aac, flac, wav, pcm

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `application/json`

- **`input` (required)**: `string`, minLength: `1`, maxLength: `10000`

  Text or prompt to generate. The `elevenlabs/eleven-v3:dialogue` model expects one `voice: text` turn per line.
- **`composition_plan`**: `object`
- **`conditioning_ref`**: `object`
- **`duration`**: `number`, minimum: `0.5`, maximum: `300`
- **`instructions`**: `string`

  Emotion/style instruction for Gemini TTS and Qwen instruct speech.
- **`instrumental`**: `boolean`
- **`loop`**: `boolean`
- **`model`**: `string`
- **`negative_prompt`**: `string`
- **`prompt_influence`**: `number`, minimum: `0`, maximum: `1`
- **`reference_audio`**: `string`, format: `uri`

  Public HTTP(S) URL for reference-audio conditioning or audio-to-audio generation.
- **`response_format`**: `string`, possible values: `"mp3", "opus", "aac", "flac", "wav", "pcm"`

  Defaults to mp3 except Gemini TTS (wav). Gemini TTS supports wav or raw 24 kHz pcm and rejects other explicit formats.
- **`safe`**: `string | boolean`

  Optional safety features; accepts a comma-separated string or boolean shorthand.
- **`seconds`**: `number`, minimum: `1`, maximum: `380`
- **`seed`**: `integer`, minimum: `0`, maximum: `4294967295`
- **`steps`**: `integer`, minimum: `1`, maximum: `100`
- **`store_for_inpainting`**: `boolean`
- **`voice`**: `string`, default: `"alloy"`

**Example: dialogue**

Multi-speaker dialogue

```json
{
  "model": "elevenlabs/eleven-v3:dialogue",
  "input": "rachel: Hello!\nadam: Hi!",
  "voice": "alloy",
  "response_format": "mp3"
}
```

## Responses

### 200 Success - Returns audio data

**Headers:**

- **`Link`**

  Public stored-file URL with rel="enclosure". Fetching it never generates media; expired files return 404. Also included when the file is wrapped in URL or base64 JSON.

  `string`

  **Example:**

  ```json
  "<https://media.pollinations.ai/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>; rel=\"enclosure\""
  ```

**Content type:** `audio/mpeg`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/opus`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/aac`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/flac`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/wav`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

**Content type:** `audio/pcm`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Generate Speech with Timestamps

- **Method:** `POST`
- **Path:** `/v1/audio/speech/with-timestamps`
- **Operation ID:** `postV1AudioSpeechWithTimestamps`
- **Tags:** Audio

Generate base64-encoded speech with character-level timing for the original and normalized text. See `/audio/models` for models advertising this endpoint.

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `application/json`

- **`input` (required)**: `string`, maxLength: `10000`

  Text to synthesize and align.
- **`model`**: `string`, possible values: `"elevenlabs/eleven-v4", "elevenlabs/eleven-v4-turbo", "elevenlabs/eleven-v3", "elevenlabs/eleven-flash-v2.5", "elevenlabs/eleven-multilingual-v2"`, default: `"elevenlabs/eleven-v3"`
- **`response_format`**: `string`, possible values: `"mp3", "opus", "aac", "wav", "pcm"`, default: `"mp3"`

  Encoding used for audio\_base64.
- **`seed`**: `integer`, minimum: `0`, maximum: `4294967295`
- **`voice`**: `string`, default: `"alloy"`

  Preset voice name or custom ElevenLabs voice ID.

**Example:**

```json
{
  "model": "elevenlabs/eleven-v3",
  "input": "",
  "voice": "alloy",
  "response_format": "mp3",
  "seed": 0
}
```

## Responses

### 200 Success - Returns base64 audio and character timings

**Content type:** `application/json`

- **`alignment` (required)**: `object`
  - **`character_end_times_seconds`**: `array of number`
  - **`character_start_times_seconds`**: `array of number`
  - **`characters`**: `array of string`
- **`audio_base64` (required)**: `string`
- **`normalized_alignment` (required)**: `object`
  - **`character_end_times_seconds`**: `array of number`
  - **`character_start_times_seconds`**: `array of number`
  - **`characters`**: `array of string`

**Example:**

```json
{
  "audio_base64": "",
  "alignment": {
    "characters": [
      ""
    ],
    "character_start_times_seconds": [
      1
    ],
    "character_end_times_seconds": [
      1
    ]
  },
  "normalized_alignment": {
    "characters": [
      ""
    ],
    "character_start_times_seconds": [
      1
    ],
    "character_end_times_seconds": [
      1
    ]
  }
}
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Transcribe Audio

- **Method:** `POST`
- **Path:** `/v1/audio/transcriptions`
- **Operation ID:** `postV1AudioTranscriptions`
- **Tags:** Audio

Transcribe audio files to text. Compatible with the OpenAI Whisper API.

**Supported audio formats:** mp3, mp4, mpeg, mpga, m4a, wav, webm

**Models:**

- `openai/whisper-large-v3` (default) — OpenAI Whisper via OVHcloud
- `whisper-1` — Alias for `openai/whisper-large-v3`
- `openai/gpt-transcribe` — Fast multilingual speech recognition with prompt context
- `elevenlabs/scribe-v2` — ElevenLabs Scribe (90+ languages, word-level timestamps)
- `x-ai/grok-transcribe` — xAI speech recognition with word timestamps, speaker labels, and text formatting
- `google/gemini-3.5-transcribe` — Google speech recognition with word timestamps and speaker labels (wav, mp3, flac, m4a, ogg, webm, aac; `prompt` is ignored)
- `assemblyai/universal-2` — AssemblyAI Universal-2 (99 languages)
- `assemblyai/universal-3.5-pro` — AssemblyAI Universal-3.5 Pro (18 languages, code switching, prompting)

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `multipart/form-data`

- **`file` (required)**: `string`, format: `binary`

  The audio file to transcribe. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm.
- **`language`**: `string`

  Language of the audio in ISO-639-1 format (e.g. `en`, `fr`). Improves accuracy.
- **`model`**: `string`, default: `"openai/whisper-large-v3"`

  The model to use. Options: `openai/whisper-large-v3`, `whisper-1`, `openai/gpt-transcribe`, `elevenlabs/scribe-v2`, `x-ai/grok-transcribe`, `google/gemini-3.5-transcribe`, `assemblyai/universal-2`, `assemblyai/universal-3.5-pro`.
- **`prompt`**: `string`

  Optional text to guide the model's style or continue a previous segment.
- **`response_format`**: `string`, possible values: `"json", "text", "srt", "verbose_json", "vtt", "diarized_json"`, default: `"json"`

  The format of the transcript output. Support is model-dependent: `srt` and `vtt` require a model that renders subtitles, and `diarized_json` a diarization-capable one. Unsupported combinations return 400 naming the formats that model accepts.
- **`speakers_expected`**: `integer`, minimum: `1`

  Optional provider hint for the number of speakers. Only honored with `response_format=diarized_json`.
- **`temperature`**: `number`

  Sampling temperature between 0 and 1. Lower is more deterministic.

**Example:**

```json
{
  "file": "@filename",
  "model": "openai/whisper-large-v3",
  "language": "",
  "prompt": "",
  "response_format": "json",
  "temperature": 1,
  "speakers_expected": 1
}
```

## Responses

### 200 Success - Returns transcription

**Content type:** `application/json`

- **`segments`**: `array`

  OpenAI-compatible diarized segments. Present when `response_format=diarized_json`.

  **Items:**
  - **`end`**: `number`
  - **`id`**: `string`
  - **`speaker`**: `string`
  - **`start`**: `number`
  - **`text`**: `string`
  - **`type`**: `string`, possible values: `"transcript.text.segment"`
- **`text`**: `string`

**Example:**

```json
{
  "text": "",
  "segments": [
    {
      "type": "transcript.text.segment",
      "id": "",
      "speaker": "",
      "text": "",
      "start": 1,
      "end": 1
    }
  ]
}
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Separate Audio Stems

- **Method:** `POST`
- **Path:** `/alpha/audio/stem-separation`
- **Operation ID:** `postAlphaAudioStemSeparation`
- **Tags:** Audio

Separate an uploaded audio file into vocals and instrumental, or vocals, drums, bass, guitar, piano, and other. Returns a ZIP of stereo 44.1 kHz MP3 files at 128 kbps. Pricing uses input duration and the selected stem variation; see /audio/models. This native alpha endpoint has no OpenAI-compatible equivalent; its request and response may change.

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Request body

**Required:** `true`

**Content type:** `multipart/form-data`

- **`file` (required)**: `string`, format: `binary`

  Source audio, up to 50 MB, with a readable duration.
- **`model`**: `string`, default: `"elevenlabs/stem-separation"`
- **`stem_variation_id`**: `string`, possible values: `"two_stems_v1", "six_stems_v1"`, default: `"six_stems_v1"`

**Example:**

```json
{
  "model": "elevenlabs/stem-separation",
  "file": "@filename",
  "stem_variation_id": "six_stems_v1"
}
```

## Responses

### 200 ZIP containing the separated MP3 tracks

**Headers:**

- **`Link`**

  Public stored-file URL with rel="enclosure". Fetching it never generates media; expired files return 404. Also included when the file is wrapped in URL or base64 JSON.

  `string`

  **Example:**

  ```json
  "<https://media.pollinations.ai/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>; rel=\"enclosure\""
  ```

**Content type:** `application/zip`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 413 The request payload is too large. Reduce its size and try again.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYLOAD_TOO_LARGE"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"The request payload is too large. Reduce its size and try again."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `413`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 413,
  "success": false,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "The request payload is too large. Reduce its size and try again.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 502 We couldn't reach our backend services. Please try again shortly.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_GATEWAY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"We couldn't reach our backend services. Please try again shortly."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `502`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 502,
  "success": false,
  "error": {
    "code": "BAD_GATEWAY",
    "message": "We couldn't reach our backend services. Please try again shortly.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.

# Generate Audio

- **Method:** `GET`
- **Path:** `/audio/{text}`
- **Operation ID:** `getAudioByText`
- **Tags:** Audio

Generate speech, dialogue, music, or sound effects from text via a simple GET request.

**Text-to-speech (default):** Returns spoken audio in the selected voice and format.

**Known voice presets:** alloy, echo, fable, onyx, nova, shimmer, ash, ballad, coral, sage, verse, rachel, domi, bella, elli, charlotte, dorothy, sarah, emily, lily, matilda, adam, antoni, arnold, josh, sam, daniel, charlie, james, fin, callum, liam, george, brian, bill, conversational\_a, conversational\_b, read\_speech\_a, read\_speech\_b, read\_speech\_c, read\_speech\_d, af\_alloy, af\_aoede, af\_bella, af\_heart, af\_jessica, af\_kore, af\_nicole, af\_nova, af\_river, af\_sarah, af\_sky, am\_adam, am\_echo, am\_eric, am\_fenrir, am\_liam, am\_michael, am\_onyx, am\_puck, am\_santa, bf\_alice, bf\_emma, bf\_isabella, bf\_lily, bm\_daniel, bm\_fable, bm\_george, bm\_lewis, ef\_dora, em\_alex, em\_santa, ff\_siwis, hf\_alpha, hf\_beta, hm\_omega, hm\_psi, if\_sara, im\_nicola, jf\_alpha, jf\_gongitsune, jf\_nezumi, jf\_tebukuro, jm\_kumo, pf\_dora, pm\_alex, pm\_santa, zf\_xiaobei, zf\_xiaoni, zf\_xiaoxiao, zf\_xiaoyi, zm\_yunjian, zm\_yunxi, zm\_yunxia, zm\_yunyang, altair, ara, atlas, aurora, carina, castor, celeste, cosmo, eve, helios, helix, iris, kepler, leo, liora, lumen, luna, lux, naksh, orion, perseus, rex, rigel, sal, sirius, ursa, zagan, zenith, Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat. ElevenLabs models also accept a custom voice ID.

**Output formats:** Model-dependent. Defaults to mp3 except Gemini TTS (wav); Gemini TTS supports wav and raw 24 kHz pcm and rejects other explicit formats. Other available formats include opus, aac, and flac.

**Dialogue:** Set `model=elevenlabs/eleven-v3:dialogue`; provide one `<voice>: <text>` turn per line.

**Music generation:** Set `model=elevenlabs/music-v2`, `elevenlabs/music-v2.5`, `google/lyria-3-clip-preview`, `google/lyria-3.5`, `stability-ai/stable-audio-3-medium`, or `stability-ai/stable-audio-3` to generate music instead of speech. `google/lyria-3.5` returns MP3 songs with approximate length described in the prompt and does not accept `duration`; `google/lyria-3-clip-preview` returns a fixed 30-second MP3 clip; the ElevenLabs Music models support `duration` (3-300 seconds) and `instrumental` mode; the Stable Audio models support `seconds` (1-380), `steps`, `seed`, and `negative_prompt`. Pass any publicly accessible audio URL as `reference_audio` to `POST /v1/audio/speech`.

## Effective servers

- `https://gen.pollinations.ai`

## Authentication

- **bearerAuth**: HTTP bearer (`API Key`)

  pollinations.ai API key (pk\_ or sk\_)

## Path parameters

- **`text` (required)**: `string`, minLength: `1`

  Text or prompt to generate. Dialogue operation expects one `voice: text` turn per line.

## Query parameters

- **`voice`**: `string`, default: `"alloy"`, minLength: `1`

  Voice preset or custom provider voice ID. Dialogue voices come from labels in the text.
- **`response_format`**: `string`, possible values: `"mp3", "opus", "aac", "flac", "wav", "pcm"`

  Audio output format. Defaults to mp3 except Gemini TTS (wav). Gemini TTS supports wav and raw 24 kHz pcm; other explicit formats are rejected. Grok TTS supports mp3, wav, and pcm; Fish Audio supports mp3 and pcm; CSM and Kokoro support mp3, opus, flac, wav, and pcm; Qwen TTS currently returns WAV regardless of this setting; `google/lyria-3.5`, `google/lyria-3-clip-preview`, and `elevenlabs/eleven-text-to-sound-v2` support mp3 only.
- **`model`**: `string`

  Audio model for speech, dialogue, music, or sound-effect generation
- **`duration`**: `string`

  Output duration in seconds for music and sound effects. Each model lists its range as `min_duration` and `max_duration`, or `allowed_durations`, in `/audio/models`.
- **`seconds`**: `number`, minimum: `0.5`, maximum: `380`

  Alias for `duration`.
- **`steps`**: `integer`, minimum: `1`, maximum: `100`

  Sampling steps (`stability-ai/stable-audio-3-medium` 1-100, `stability-ai/stable-audio-3` 4-8)
- **`negative_prompt`**: `string`

  Negative prompt for `stability-ai/stable-audio-3`
- **`instrumental`**: `string`, possible values: `"true", "false"`, default: `"false"`

  If true, guarantees instrumental output (`elevenlabs/music-v2` and `elevenlabs/music-v2.5` only)
- **`instructions`**: `string`

  Emotion/style instruction (Gemini TTS and `qwen/qwen3-tts-instruct-flash`)
- **`loop`**: `string`, possible values: `"true", "false"`

  Loop the generated sound effect (`elevenlabs/eleven-text-to-sound-v2` only)
- **`prompt_influence`**: `string`

  How strictly to follow the prompt, 0-1 (`elevenlabs/eleven-text-to-sound-v2` only)
- **`seed`**: `integer`, minimum: `-1`, maximum: `4294967295`

  Seed passed to the model. Same seed + parameters return the same cached result while available.
- **`key`**: `string`

  API key (alternative to Authorization header)
- **`safe`**: `string | boolean`

  Safety features: comma-separated list of privacy, secrets, sexual, violence, shield, true, nsfw. true enables privacy,secrets; nsfw enables sexual,violence. Also accepted in the Pollinations-Safe header. Defaults to off; false and 0 are accepted as off.

## Responses

### 200 Success - Returns audio data

**Headers:**

- **`Link`**

  Public stored-file URL with rel="enclosure". Fetching it never generates media; expired files return 404. Also included when the file is wrapped in URL or base64 JSON.

  `string`

  **Example:**

  ```json
  "<https://media.pollinations.ai/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef>; rel=\"enclosure\""
  ```

**Content type:** `audio/mpeg`

`string`, format: `binary`

**Example:**

```json
"@filename"
```

### 400 Something was wrong with the input data, check the details for more info.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"BAD_REQUEST", "content_blocked", "failed_to_download_image", "invalid_image_url", "image_too_large", "unsupported_image_media_type"`
  - **`details` (required)**: `object`, schema: `ValidationErrorDetails`
    - **`fieldErrors` (required)**: `object`

      **Additional properties:**

      `array of string`
    - **`formErrors` (required)**: `array of string`
    - **`name` (required)**: `string`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Something was wrong with the input data, check the details for more info."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `400`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Something was wrong with the input data, check the details for more info.",
    "timestamp": "",
    "details": {
      "name": "",
      "formErrors": [
        ""
      ],
      "fieldErrors": {
        "additionalProperty": [
          ""
        ]
      }
    },
    "requestId": ""
  }
}
```

### 401 Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"UNAUTHORIZED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`
    - **`name` (required)**: `string`
    - **`upstreamBody`**: `string`

      Original provider response body, without redaction or truncation.
    - **`upstreamHost`**: `string`
    - **`upstreamStatus`**: `integer`, minimum: `-9007199254740991`, maximum: `9007199254740991`
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `401`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 401,
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please provide an API key via Authorization header (Bearer token) or ?key= query parameter.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 402 Insufficient pollen balance or API key budget exhausted.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"PAYMENT_REQUIRED", "KEY_BUDGET_EXHAUSTED", "INSUFFICIENT_BALANCE", "QUEST_POLLEN_ONLY"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Insufficient pollen balance or API key budget exhausted."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `402`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 402,
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Insufficient pollen balance or API key budget exhausted.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 403 Access denied! You don't have the required permissions for this resource or model.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"FORBIDDEN"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Access denied! You don't have the required permissions for this resource or model."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `403`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 403,
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied! You don't have the required permissions for this resource or model.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 429 You're making requests too quickly. Please slow down a bit.

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"RATE_LIMITED"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"You're making requests too quickly. Please slow down a bit."`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `429`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 429,
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "You're making requests too quickly. Please slow down a bit.",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

### 500 Oh snap, something went wrong on our end. We're on it!

**Content type:** `application/json`

- **`error` (required)**: `object`
  - **`code` (required)**: `string`, possible values: `"INTERNAL_ERROR"`
  - **`details` (required)**: `object`, schema: `ErrorDetails`

    *Schema `ErrorDetails` is shown above.*
  - **`message` (required)**

    **Any of:**
    - `string`, const: `"Oh snap, something went wrong on our end. We're on it!"`
    - `string`
  - **`timestamp` (required)**: `string`
  - **`requestId`**: `string`
- **`status` (required)**: `number`, const: `500`
- **`success` (required)**: `boolean`, const: `false`

**Example:**

```json
{
  "status": 500,
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Oh snap, something went wrong on our end. We're on it!",
    "timestamp": "",
    "details": {
      "name": "",
      "upstreamStatus": -9007199254740991,
      "upstreamHost": "",
      "upstreamBody": ""
    },
    "requestId": ""
  }
}
```

## Schemas

- `ValidationErrorDetails` — shown above.
- `ErrorDetails` — shown above.
