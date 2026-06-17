// Calcula los segundos acumulados en "espera del cliente" (RF-B03),
// incluyendo el intervalo abierto si la tarea esta ahora mismo en espera.
export function esperaSegundos(tarea) {
  let s = tarea.esperaClienteSegundos || 0;
  if (tarea.esperaClienteDesde) {
    s += Math.max(0, Math.floor((Date.now() - new Date(tarea.esperaClienteDesde).getTime()) / 1000));
  }
  return s;
}

export function formatEspera(seg) {
  if (!seg || seg <= 0) return null;
  const dias = seg / 86400;
  if (dias >= 1) return `${dias.toFixed(1)} d`;
  const horas = seg / 3600;
  if (horas >= 1) return `${horas.toFixed(0)} h`;
  return `${Math.max(1, Math.floor(seg / 60))} min`;
}
