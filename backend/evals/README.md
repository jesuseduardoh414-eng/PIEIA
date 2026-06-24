# Datasets dorados y evals (TRD §8)

Cada agente se evalúa contra los 5 proyectos históricos. Un agente **no se libera ni se
actualiza su prompt** si no cumple su métrica de liberación (§7 del TRD).

## Cómo agregar un caso dorado

1. Pon el **archivo de entrada** real del proyecto en `evals/fixtures/`
   (el Excel de diseño para AG-01, el PDF de mecánica de suelos para AG-02, etc.).
2. Crea un `.json` en `evals/casos/` con la **respuesta correcta conocida** (la que ya
   produjo el despacho manualmente). Usa las plantillas `*-ejemplo.json` como guía.
3. Corre las evals desde **Admin → Evals → "Correr evals"** (consume créditos de LLM),
   o por CLI: `node prisma/runEvals.js`.

## Formato por agente

### AG-01 (cuantificación)
```json
{
  "id": "ag01-castanos",
  "agente": "AG-01",
  "descripcion": "Cuantificación Castaños de Vergel",
  "archivo": "fixtures/castanos-diseno.xlsx",
  "esperado": {
    "concretoM3": 142.5,
    "aceroKg": 8750,
    "conceptosClave": ["I-A.01", "II-A.01"]
  },
  "tolerancias": { "concretoPct": 5, "aceroPct": 5, "mapeoMinPct": 90 }
}
```
**Métrica de liberación:** desviación ≤ 5% en concreto (m³) y acero (kg), y ≥ 90% de
los `conceptosClave` presentes.

### AG-02 (auditor de inputs)
```json
{
  "id": "ag02-castanos-suelos",
  "agente": "AG-02",
  "tipo": "mecanica_suelos",
  "descripcion": "Mecánica de suelos Castaños",
  "archivo": "fixtures/castanos-suelos.pdf",
  "esperado": {
    "campos": { "capacidadCargaAdmisible": 15, "profundidadDesplante": 1.5, "tipoCimentacion": "pilotes" }
  },
  "tolerancias": { "numericoPct": 5, "recallMinPct": 90 }
}
```
**Métrica:** recall ≥ 90% de los campos esperados (números dentro de ±5%, textos por
coincidencia de subcadena).

### AG-04 (RAG normativo)
```json
{
  "id": "ag04-viento-mty",
  "agente": "AG-04",
  "descripcion": "Velocidad de viento regional Monterrey",
  "pregunta": "¿Cuál es la velocidad regional de viento para Monterrey?",
  "esperado": { "contiene": ["Monterrey", "km/h"], "fuentesMin": 1 }
}
```
**Métrica:** la respuesta contiene todas las subcadenas de `contiene` y ≥ `fuentesMin`
fuentes citadas.

> Las plantillas en `casos/*-ejemplo.json` tienen `"plantilla": true` y el runner las
> ignora hasta que pongas datos reales y quites esa bandera.
