// Precios por 1M tokens (USD) — actualizar si cambian las tarifas
const PRECIOS = {
  'claude-sonnet-4-6':       { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':        { input: 0.80,  output: 4.00  },
  'claude-opus-4-8':         { input: 15.00, output: 75.00 },
  'voyage-3':                { input: 0.06,  output: 0     },
  'voyage-3-lite':           { input: 0.02,  output: 0     },
};

export function calcularCostoAnthropic(modelo, inputTokens, outputTokens) {
  const precios = PRECIOS[modelo] ?? PRECIOS['claude-sonnet-4-6'];
  return (inputTokens * precios.input + outputTokens * precios.output) / 1_000_000;
}

export function calcularCostoVoyage(modelo, totalTokens) {
  const precios = PRECIOS[modelo] ?? PRECIOS['voyage-3'];
  return (totalTokens * precios.input) / 1_000_000;
}

export function formatCostoUSD(usd) {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(4)} mUSD`;
  return `$${usd.toFixed(4)} USD`;
}
