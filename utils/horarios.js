// Utilidades para calcular los horarios disponibles de un medico en un dia dado.
// Todo el calculo de disponibilidad vive aqui y en el servidor (nunca en el cliente),
// tal como se definio en el diseño: la disponibilidad siempre se valida en el backend.

function horaAMinutos(horaStr) {
  // 'HH:MM:SS' o 'HH:MM' -> minutos desde medianoche
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + m;
}

function minutosAHora(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

// Genera los horarios de inicio posibles dentro de los bloques, segun la duracion de la cita.
// bloques: [{ hora_inicio: '07:00:00', hora_fin: '12:00:00' }, ...]
// duracionMinutos: duracion de cada cita segun la especialidad del medico
function generarSlots(bloques, duracionMinutos) {
  const slots = [];
  for (const bloque of bloques) {
    const inicio = horaAMinutos(bloque.hora_inicio);
    const fin = horaAMinutos(bloque.hora_fin);
    for (let t = inicio; t + duracionMinutos <= fin; t += duracionMinutos) {
      slots.push(minutosAHora(t));
    }
  }
  return slots;
}

module.exports = { horaAMinutos, minutosAHora, generarSlots };
