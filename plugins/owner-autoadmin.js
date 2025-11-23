const handler = async (m, { conn, isAdmin, groupMetadata }) => {
  try {

    // Si ya es admin
    if (isAdmin) {
      return conn.sendMessage(
        m.chat,
        { text: '*𝖸𝖺 𝖤𝗋𝖾𝗌 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*', ...global.rcanal },
        { quoted: m }
      );
    }

    // Reacción inicial
    await conn.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } });

    // Promover
    await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote');

    // Reacción final
    await conn.sendMessage(m.chat, { react: { text: '⭐', key: m.key } });

    // Confirmación
    return conn.sendMessage(
      m.chat,
      { text: '*𝖸𝖺 𝖳𝖾 𝖣𝗂 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*', ...global.rcanal },
      { quoted: m }
    );

  } catch (e) {

    // Reacción de error
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });

    return conn.sendMessage(
      m.chat,
      { text: '*𝖣𝖾𝗆𝖺𝗌𝗂𝖺𝖽𝗈 𝖡𝗎𝖾𝗇𝗈 𝖯𝖺𝗋𝖺 𝖲𝖾𝗋 𝖵𝖾𝗋𝖽𝖺𝖽, 𝖭𝗈 𝖯𝗎𝖾𝖽𝗈 𝖣𝖺𝗋𝗍𝖾 𝖠𝖽𝗆𝗂𝗇*', ...global.rcanal },
      { quoted: m }
    );
  }
};

handler.command = ['autoadmin', 'tenerpoder'];
handler.rowner = true;  // Solo owner real
handler.group = true;

export default handler;