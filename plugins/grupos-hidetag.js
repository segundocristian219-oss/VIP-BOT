// .n -> reenviar y notificar a todos
import { generateWAMessageFromContent } from '@whiskeysockets/baileys' // si lo usas en tu setup, opcional
// Ajusta imports según tu estructura

let handler = async (m, { conn }) => {
  try {
    if (!m.isGroup) return conn.reply(m.chat, 'Este comando solo funciona en grupos.', m);

    // Obtener el mensaje a reenviar: si hay m.quoted (respondiste), usarlo; si no, usar el propio m
    const messageToForward = m.quoted ? m.quoted : m;

    // Obtener participantes del grupo
    const meta = await conn.groupMetadata(m.chat);
    let participants = meta.participants.map(p => p.id);

    // Quitar el id del bot (no lo mencionamos a sí mismo)
    const botId = conn.user && conn.user.id ? conn.user.id : (conn.user && conn.user.jid ? conn.user.jid : null);
    if (botId) participants = participants.filter(id => id !== botId);

    // 1) enviar un texto arriba que indique "Reenviado" y que mencione a todos (notify everyone)
    // Nota: la opción 'mentions' funciona para notificar/etiquetar a los usuarios.
    await conn.sendMessage(m.chat, {
      text: '🔁 Reenviado',
      mentions: participants
    }, { quoted: m });

    // 2) reenviar (forward) el mensaje original tal cual
    // copyNForward preserva el tipo (texto/media/sticker)
    // true fuerza la forward (sin atribuir al bot)
    await conn.copyNForward(m.chat, messageToForward, true, { 
      // quoted: m, // opcional: si quieres que el reenvío aparezca citado al comando
      // contextInfo: { mentionedJid: participants } // normalmente no hace falta aquí, ya hicimos la mención arriba
    });

  } catch (err) {
    console.error(err);
    try {
      await conn.reply(m.chat, 'Ocurrió un error al reenviar. Revisa la consola.', m);
    } catch (e) { /* no hacer nada */ }
  }
}

// Opciones del handler (ajusta según tu framework)
handler.customPrefix = /^(\.n|n)(\s|$)/i;
handler.command = new RegExp(); // permite customPrefix
handler.group = true; // solo en grupos
export default handler;