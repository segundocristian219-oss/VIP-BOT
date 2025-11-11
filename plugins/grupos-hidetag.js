let handler = async (m, { conn }) => {
  try {
    if (!m.isGroup)
      return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m);

    // Texto después del .n
    const body = m.text || '';
    const text = body.replace(/^(\.n|n)\s*/i, '').trim();

    // Info del grupo
    const groupMetadata = await conn.groupMetadata(m.chat);
    const participants = groupMetadata.participants.map(p => p.id);
    const botNumber = conn.user?.id || conn.user?.jid;
    const mentions = participants.filter(id => id !== botNumber);

    // === CASO 1: Mensaje citado (foto, video, sticker, etc.) ===
    if (m.quoted) {
      // Tomamos el objeto completo del mensaje citado
      const quoted = m.quoted.fakeObj || m.quoted;

      await conn.sendMessage(m.chat, {
        text: '📣 *Notificación:* mensaje reenviado',
        mentions
      }, { quoted: m });

      // Reenviar usando la estructura original
      await conn.sendMessage(m.chat, { forward: quoted }, { quoted: m });
      return;
    }

    // === CASO 2: Texto simple (.n hola) ===
    if (text.length > 0) {
      await conn.sendMessage(m.chat, {
        text: '📣 *Notificación:* mensaje reenviado',
        mentions
      }, { quoted: m });

      await conn.sendMessage(m.chat, {
        text
      }, { quoted: m });
      return;
    }

    // === CASO 3: Nada ===
    await conn.reply(m.chat, '❌ No hay nada para reenviar.', m);

  } catch (err) {
    console.error('Error en .n:', err);
    await conn.reply(m.chat, '❌ Ocurrió un error al reenviar.\n' + err.message, m);
  }
};

handler.customPrefix = /^(\.n|n)(\s|$)/i;
handler.command = new RegExp();
handler.group = true;
export default handler;