import {
  hasCapability,
  normalizeOllamaModel,
  normalizeOllamaRunning,
  type OllamaShow,
  type OllamaTag
} from './models'

// model_info as the real Ollama 0.32.6 reported it on 10/08/2026, trimmed to
// the keys this module reads. Two of these models — mistral:7b and llama3.1:8b
// — were uninstalled the same day (D15.8), so their payloads survive only here.
// That makes the fixture the regression's last line of defence, not a
// convenience: nobody is going to re-download 4,6 GB to rediscover the trap.

const gemma3_4b: OllamaShow = {
  capabilities: ['completion', 'vision'],
  model_info: {
    'gemma3.attention.head_count': 8,
    'gemma3.attention.head_count_kv': 4,
    'gemma3.attention.key_length': 256,
    'gemma3.attention.value_length': 256,
    'gemma3.attention.sliding_window': 1024,
    'gemma3.block_count': 34,
    'gemma3.context_length': 131072,
    'gemma3.embedding_length': 2560,
    // The second, parallel namespace a vision model carries. Every key here
    // ends with the same suffix as its text-tower twin.
    'gemma3.vision.attention.head_count': 16,
    'gemma3.vision.block_count': 27,
    'gemma3.vision.embedding_length': 1152
  }
}

const mistral7b: OllamaShow = {
  capabilities: ['completion', 'tools'],
  model_info: {
    'llama.attention.head_count': 32,
    'llama.attention.head_count_kv': 8,
    'llama.block_count': 32,
    'llama.context_length': 32768,
    'llama.embedding_length': 4096,
    'llama.rope.dimension_count': 128
  }
}

const qwenCoder3b: OllamaShow = {
  capabilities: ['completion', 'tools', 'insert'],
  model_info: {
    'qwen2.attention.head_count': 16,
    'qwen2.attention.head_count_kv': 2,
    'qwen2.block_count': 36,
    'qwen2.context_length': 32768,
    'qwen2.embedding_length': 2048
  }
}

const phi4Mini: OllamaShow = {
  capabilities: ['completion', 'tools'],
  model_info: {
    'phi3.attention.head_count': 24,
    'phi3.attention.head_count_kv': 8,
    // Larger than this model's own 131072 ceiling — the window never closes
    // over anything. Preserved raw; the budget math decides it is inert.
    'phi3.attention.sliding_window': 262144,
    'phi3.block_count': 32,
    'phi3.context_length': 131072,
    'phi3.embedding_length': 3072
  }
}

const nomicEmbed: OllamaShow = {
  capabilities: ['embedding'],
  model_info: {
    'nomic-bert.context_length': 2048,
    'nomic-bert.embedding_length': 768
  }
}

function tag(name: string, size = 1_000, parameterSize = '4.3B'): OllamaTag {
  return { name, size, details: { parameter_size: parameterSize } }
}

/** What `ollama create` produces: a parent, and 27 bytes of Modelfile over it. */
function derived(name: string, parent: string): OllamaTag {
  return { name, size: 1_027, details: { parameter_size: '4.3B', parent_model: parent } }
}

describe('normalizeOllamaModel', () => {
  it('reads capabilities from /api/show, which is the only place vision appears', () => {
    const model = normalizeOllamaModel(tag('gemma3:4b'), gemma3_4b)

    expect(model.capabilities).toEqual(['completion', 'vision'])
    expect(hasCapability(model, 'vision')).toBe(true)
  })

  it('does not see vision when handed the /api/tags capabilities instead', () => {
    // The regression this exists to catch: /api/tags reports gemma3:4b as
    // ["completion"] while reporting `tools` correctly for other models, so a
    // gate built on it fails only for the one model that can actually see.
    const fromTags: OllamaShow = { ...gemma3_4b, capabilities: ['completion'] }

    expect(hasCapability(normalizeOllamaModel(tag('gemma3:4b'), fromTags), 'vision')).toBe(false)
  })

  it('lets an unknown capability through instead of filtering to a known list', () => {
    // `insert` arrived with the qwen2.5-coder models and no model in the fleet
    // had it before. A closed enum would have turned a newly installed model
    // into a parse error for the whole catalog.
    const model = normalizeOllamaModel(tag('qwen2.5-coder:3b'), qwenCoder3b)

    expect(model.capabilities).toContain('insert')
  })

  describe('the context ceiling key', () => {
    it('finds it under a family prefix unrelated to the model name', () => {
      // mistral:7b answers under `llama.context_length` — the prefix is neither
      // the commercial family nor the model name. This is the case that breaks
      // if anyone "fixes" the lookup to build the key from the name.
      expect(normalizeOllamaModel(tag('mistral:7b'), mistral7b).contextLength).toBe(32768)
    })

    it.each([
      ['gemma3:4b', gemma3_4b, 131072],
      ['qwen2.5-coder:3b', qwenCoder3b, 32768],
      ['phi4-mini', phi4Mini, 131072],
      ['nomic-embed-text', nomicEmbed, 2048]
    ])('finds it for %s without constructing the prefix', (name, show, expected) => {
      expect(normalizeOllamaModel(tag(name), show).contextLength).toBe(expected)
    })

    it('is null when model_info is absent entirely', () => {
      expect(normalizeOllamaModel(tag('x'), {}).contextLength).toBeNull()
    })
  })

  describe('the attention block', () => {
    it('ignores the vision namespace of a multimodal model', () => {
      // A vision model carries a second, parallel namespace: the text tower has
      // 34 blocks, the vision tower 27, and both keys end in `.block_count`.
      const { attention } = normalizeOllamaModel(tag('gemma3:4b'), gemma3_4b)

      expect(attention?.blockCount).toBe(34)
      expect(attention?.headDim).toBe(256)
    })

    it('ignores a sub-namespace that sorts BEFORE the wanted key', () => {
      // Synthetic, and the only synthetic fixture here — deliberately so.
      //
      // Ollama returns model_info sorted, and `vision` happens to sort after
      // `attention`, `block_count` and `embedding_length`. That means suffix
      // matching plus first-match would pass the test above by luck, not by
      // correctness. This case removes the luck: `audio` sorts BEFORE
      // `block_count`, so a suffix match would return 8 instead of 32.
      //
      // Not idle either — audio towers exist on this family's siblings, and
      // the real payload already shows a third sub-namespace (`gemma3.mm.*`).
      const withAudioTower: OllamaShow = {
        model_info: {
          'gemma3.audio.attention.head_count_kv': 2,
          'gemma3.audio.block_count': 8,
          'gemma3.audio.embedding_length': 512,
          'gemma3.attention.head_count_kv': 4,
          'gemma3.attention.key_length': 256,
          'gemma3.block_count': 32
        }
      }

      const { attention } = normalizeOllamaModel(tag('gemma3n'), withAudioTower)

      expect(attention?.blockCount).toBe(32)
      expect(attention?.headCountKv).toBe(4)
    })

    it('takes headDim from key_length when the model reports it', () => {
      expect(normalizeOllamaModel(tag('gemma3:4b'), gemma3_4b).attention?.headDim).toBe(256)
    })

    it.each([
      ['mistral:7b', mistral7b, 128],
      ['qwen2.5-coder:3b', qwenCoder3b, 128],
      ['phi4-mini', phi4Mini, 128]
    ])('derives headDim from embedding_length / head_count for %s', (name, show, expected) => {
      expect(normalizeOllamaModel(tag(name), show).attention?.headDim).toBe(expected)
    })

    it('preserves a sliding window larger than the model own ceiling', () => {
      // Deciding the window is inert needs a ceiling to compare against, and
      // that is the budget math's job. Normalization does not interpret.
      const { attention } = normalizeOllamaModel(tag('phi4-mini'), phi4Mini)

      expect(attention?.slidingWindow).toBe(262144)
    })

    it('reports no window for a model that declares none', () => {
      expect(normalizeOllamaModel(tag('mistral:7b'), mistral7b).attention?.slidingWindow).toBeNull()
    })

    it('is null for an embedder, without throwing', () => {
      // nomic-embed-text reports a context length and an embedding length but
      // no block count and no attention heads. It is never offered for
      // conversation, and losing the whole catalog over it would be absurd.
      const model = normalizeOllamaModel(tag('nomic-embed-text'), nomicEmbed)

      expect(model.attention).toBeNull()
      expect(model.contextLength).toBe(2048)
    })
  })

  it('carries the provider discriminant and the tag-side fields', () => {
    const model = normalizeOllamaModel(tag('qwen2.5-coder:3b', 1_929_000_000, '3.1B'), qwenCoder3b)

    expect(model.provider).toBe('ollama')
    expect(model.name).toBe('qwen2.5-coder:3b')
    expect(model.sizeBytes).toBe(1_929_000_000)
    expect(model.parameterSize).toBe('3.1B')
  })

  it('falls back to an empty parameter size when details are missing', () => {
    expect(normalizeOllamaModel({ name: 'x', size: 1 }, {}).parameterSize).toBe('')
  })

  describe('variantOf', () => {
    it('names the parent of a model built from another one', () => {
      const model = normalizeOllamaModel(derived('gemma3-4b-custom:latest', 'gemma3:4b'), gemma3_4b)

      expect(model.variantOf).toBe('gemma3:4b')
    })

    it('is null for a pulled model, whether the field is empty or absent', () => {
      expect(normalizeOllamaModel(tag('gemma3:4b'), gemma3_4b).variantOf).toBeNull()
      expect(
        normalizeOllamaModel({ name: 'x', size: 1, details: { parent_model: '' } }, {}).variantOf
      ).toBeNull()
    })

    it('names the parent even when the variant declares a system prompt', () => {
      // The exception this replaces read a system prompt as "a different
      // assistant". Measured on qwen7b-custom, what `ollama create` actually
      // copies forward is the vendor's own boilerplate — "You are Qwen, created
      // by Alibaba Cloud." — so the exception fired on the one case it was
      // meant to exclude and on none of the cases it was meant to protect.
      const model = normalizeOllamaModel(derived('qwen7b-custom:latest', 'qwen2.5:7b'), qwenCoder3b)

      expect(model.variantOf).toBe('qwen2.5:7b')
    })
  })
})

/*
 * /api/ps — what is RESIDENT, which is a different question from what is
 * installed. `size` there is weights plus the KV cache of the window it was
 * loaded with, so it never matches the disk figure from /api/tags.
 */
describe('normalizeOllamaRunning', () => {
  it('reads the resident size and the expiry as epoch milliseconds', () => {
    const entry = normalizeOllamaRunning({
      name: 'gemma3:4b',
      size: 4_800_000_000,
      expires_at: '2026-08-11T14:38:31.837530-03:00'
    })

    expect(entry.name).toBe('gemma3:4b')
    expect(entry.sizeBytes).toBe(4_800_000_000)
    expect(entry.expiresAt).toBe(Date.parse('2026-08-11T14:38:31.837530-03:00'))
  })

  it('turns an absent or unparseable expiry into 0, never NaN', () => {
    // NaN would flow into the interface's own arithmetic and render as "sai em
    // ~NaN min" — absence has to have the shape of absence.
    expect(normalizeOllamaRunning({ name: 'x', size: 1 }).expiresAt).toBe(0)
    expect(normalizeOllamaRunning({ name: 'x', size: 1, expires_at: 'nunca' }).expiresAt).toBe(0)
  })
})
