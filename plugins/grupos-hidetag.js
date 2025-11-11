let handler = async (m, { conn }) => {
  try {
    if (!m.isGroup) return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m);

    // Si respondes a un mensaje, usa ese. Si no, usa el mismo mensaje
    const msg = m.quoted ? m.quoted : m;

    if (!msg.message) 
      return conn.reply(m.chat, '❌ No hay ningún mensaje para reenviar.', m);

    // Obtener lista de miembros del grupo
    const groupMetadata = await conn.groupMetadata(m.chat);
    const participants = groupMetadata.participants.map(p => p.id);

    // Quitar el bot de la lista de menciones
    const botNumber = conn.user?.id || conn.user?.jid;
    const mentions = participants.filter(id => id !== botNumber);

    // 📣 Notificación arriba
    await conn.sendMessage(m.chat, {
      text: '📣 *Notificación:* mensaje reenviado',
      mentions
    }, { quoted: m });

    // 🔁 Reenviar el mensaje original (funciona para texto, imagen, video, sticker, etc.)
    await conn.sendMessage(m.chat, { forward: msg }, { quoted: m });

  } catch (err) {
    console.error('Error en .n:', err);
    await conn.reply(m.chat, '❌ Ocurrió un error al reenviar.\n' + err.message, m);
  }
};

handler.customPrefix = /^(\.n|n)(\s|$)/i;
handler.command = new RegExp();
handler.group = true;
export default handler;