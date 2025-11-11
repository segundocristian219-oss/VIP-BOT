let handler = async (m, { conn }) => {
  try {
    if (!m.isGroup)
      return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m);

    const body =
      m.text ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption ||
      '';

    const text = body.replace(/^(\.n|n)\s*/i, '').trim();

    const groupMetadata = await conn.groupMetadata(m.chat);
    const participants = groupMetadata.participants.map(p => p.id);
    const botNumber = conn.user?.id || conn.user?.jid;
    const mentions = participants.filter(id => id !== botNumber);

    if (m.quoted) {
      const quoted = m.quoted?.message
        ? { key: m.quoted.key, message: m.quoted.message }
        : m.quoted.fakeObj || m.quoted;

      await conn.sendMessage(m.chat, { forward: quoted }, { quoted: m });
      return;
    }

    if (text.length > 0) {
      await conn.sendMessage(m.chat, { text }, { quoted: m });
      return;
    }

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