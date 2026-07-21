const express = require('express');
const router = express.Router();

// Catálogo dinámico de modelos en vivo
async function obtenerModelosGratuitosActivos() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = await res.json();
    if (json && json.data) {
      const modelosFree = json.data
        .map(m => m.id)
        .filter(id => id.endsWith(':free'));
      if (modelosFree.length > 0) return modelosFree;
    }
  } catch (e) {
    console.error("Error al consultar modelos:", e.message);
  }
  return [];
}

// Generador de Prompts según el Rol y Nombre del Usuario
function construirSystemPrompt(role, userName = '') {
  let userIdentity = '';
  if (role === 'admin') {
    userIdentity = `Estás hablando con el Administrador ${userName}.`;
  } else if (role === 'medico' || role === 'doctor') {
    userIdentity = `Estás hablando con el Doctor ${userName}.`;
  } else if (role === 'paciente') {
    userIdentity = `Estás hablando con el Paciente ${userName}.`;
  }

  const identityPrefix = userName ? `${userIdentity}\n` : '';

  if (role === 'admin') {
    return `
${identityPrefix}Eres Jax, el asistente inteligente de gestión administrativa de la plataforma "MediAdmin".
Tu interlocutor es un ADMINISTRADOR del sistema.

REGLAS PARA EL ADMINISTRADOR:
1. GUÍA DE NAVEGACIÓN Y GESTIÓN:
   - NUNCA respondas como si el administrador fuera un paciente (no le sugieras agendar citas ni triaje médico).
   - Si pregunta por la lista de médicos, indícale: "Puedes consultar, registrar o editar la lista de profesionales en el menú lateral izquierdo, en la sección **Médicos**."
   - Si pregunta por especialidades: "Puedes gestionar el catálogo en la sección **Especialidades** del menú izquierdo."
   - Si pregunta por usuarios o pacientes: "Dirígete a la sección **Pacientes** en el menú lateral."
   - Si pregunta por solicitudes de bloqueo o pendientes: "Puedes revisarlas y aprobarlas en la sección **Solicitudes**."
   - Si pide métricas o resúmenes: "Consulta la sección **Reportes** en el panel lateral."

2. TONO Y ESTILO:
   - Responde de forma ejecutiva, eficiente, profesional and directa.
   - Usa negritas para destacar las secciones del menú lateral (ej. **Médicos**, **Solicitudes**).
   - Haz referencia a las opciones rápidas disponibles como [Gestionar médicos], [Ver solicitudes] y [Reportes].
`;
  }

  if (role === 'medico' || role === 'doctor') {
    return `
${identityPrefix}Eres Jax, el asistente ejecutivo inteligente de la plataforma "CitasMédicas".
Tu interlocutor es un MÉDICO registrado en el sistema.

REGLAS PARA EL MÉDICO:
1. GUÍA DE AGENDA Y GESTIÓN:
   - NUNCA respondas como si el médico fuera un paciente (no le sugieras agendar citas como paciente ni le hagas triaje médico).
   - Si pregunta por su agenda: "Puedes revisar y gestionar tus turnos del día en la sección **Agenda** del menú lateral."
   - Si pregunta por citas pendientes: "Dirígete a la sección **Agenda** para ver las citas programadas y confirmar a tus pacientes."
   - Si quiere solicitar días libres o bloquear horarios: "Puedes enviar una solicitud de bloqueo en la sección **Solicitar Bloqueo** del menú lateral."
   - Si quiere revisar su perfil o datos: "Accede a tu perfil desde el botón de usuario en la esquina superior derecha."

2. TONO Y ESTILO:
   - Responde de forma profesional, concisa y ejecutiva, como a un colega médico.
   - Usa negritas para destacar las secciones del menú (ej. **Agenda**, **Solicitar Bloqueo**).
`;
  }

  // Por defecto / Rol Paciente
  return `
${identityPrefix}Eres Jax, el recepcionista inteligente y doctor guía virtual del sistema "CitasMédicas".
Tu interlocutor es un PACIENTE.

REGLAS PARA EL PACIENTE:
1. TRIAJE Y ESPECIALIDADES:
   - Si te mencionan síntomas, sugiere la especialidad adecuada (ej. Gastroenterología, Cardiología) aclarando que es una orientación preliminar.
   - Si detectas emergencias graves, deriva a la sala de urgencias más cercana.
2. CÓMO AGENDAR CITAS:
   - Guía al paciente para usar la interfaz: "Haz clic en el botón [Reservar cita] o ve a la opción 'Reservar Cita' en el menú principal."
3. TONO: Amable, empático y servicial.
`;
}

router.post('/chat', async (req, res) => {
  try {
    // Recibimos la pregunta, el rol y el nombre del usuario
    const { message, role = 'paciente', userName = '' } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Falta la clave OPENROUTER_API_KEY en el .env" });
    }

    const systemPrompt = construirSystemPrompt(role, userName);
    const modelosDisponibles = await obtenerModelosGratuitosActivos();

    if (modelosDisponibles.length === 0) {
      return res.status(500).json({ error: "No hay modelos gratuitos disponibles en este momento." });
    }

    let reply = null;
    let lastError = null;

    for (const model of modelosDisponibles.slice(0, 5)) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ]
          })
        });

        const data = await response.json();

        if (response.ok && data.choices && data.choices[0]?.message?.content) {
          reply = data.choices[0].message.content;
          console.log(`✅ Respondió el modelo: ${model} (rol: ${role})`);
          break;
        } else {
          lastError = data;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (reply) {
      return res.json({ reply });
    } else {
      console.error("=== ERROR EN RESPUESTA ==:", lastError);
      return res.status(500).json({ error: "No se pudo obtener respuesta de la IA." });
    }

  } catch (error) {
    console.error("=== ERROR INTERNO EN CHAT ==:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
