const handler = async (m, {conn, isAdmin, groupMetadata }) => {
  if (isAdmin) return m.reply('⭐ *¡YA ERES ADM JEFE!*');
  try {
    await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote');
  await m.react(done)
   m.reply('⭐ *¡YA TE DI ADM MI JEFE!*');
    let nn = conn.getName(m.sender);
     conn.reply('544123989549@s.whatsapp.net', `⭐ *${nn}* se dio Auto Admin en:\n> ${groupMetadata.subject}.`, m, rcanal, );
  } catch {
    m.reply('Demasiado Bueno 👻');
  }
};
handler.command = ['autoadmin' ,'tenerpoder'];
handler.rowner = true;
handler.group = true;
export default handler;