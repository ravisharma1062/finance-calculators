type Messages = Record<string, unknown>;

function isObject(v: unknown): v is Messages {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge `override` into `base`. Missing keys in a translation fall back to English. */
export function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    out[k] = isObject(b) && isObject(v) ? deepMerge(b, v) : v;
  }
  return out;
}

export async function loadMessages(locale: string): Promise<Messages> {
  const language = locale.split('-')[0];
  const en: Messages = {
    ...(await import('../../messages/en.json')).default,
    calculators: (await import('../../messages/en.calculators.json')).default,
  };
  if (language === 'hi') {
    const hi: Messages = {
      ...(await import('../../messages/hi.json')).default,
      calculators: (await import('../../messages/hi.calculators.json')).default,
    };
    return deepMerge(en, hi);
  }
  return en;
}

/** Messages the browser needs. Long page text (FAQ, formulas) stays on the server. */
export function clientMessages(messages: Messages): Messages {
  const { calculators, ...rest } = messages;
  const slim: Messages = {};
  if (isObject(calculators)) {
    for (const [slug, v] of Object.entries(calculators)) {
      if (!isObject(v)) continue;
      slim[slug] = { fields: v.fields, hints: v.hints };
    }
  }
  return { ...rest, calculators: slim };
}
