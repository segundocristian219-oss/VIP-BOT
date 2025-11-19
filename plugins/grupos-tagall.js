const handler = async (m, { conn, participants, isAdmin, isOwner }) => {
  if (!m.isGroup) return;
  if (!isAdmin && !isOwner) return global.dfail?.('admin', m, conn);

  const flagMap = {
    "591": "🇧🇴", "593": "🇪🇨", "595": "🇵🇾", "598": "🇺🇾", "507": "🇵🇦",
    "505": "🇳🇮", "506": "🇨🇷", "502": "🇬🇹", "503": "🇸🇻", "504": "🇭🇳",
    "509": "🇭🇹", "549": "🇦🇷", "54": "🇦🇷", "55": "🇧🇷", "56": "🇨🇱",
    "57": "🇨🇴", "58": "🇻🇪", "52": "🇲🇽", "53": "🇨🇺", "51": "🇵🇪",
    "1": "🇺🇸", "34": "🇪🇸"
  };

  // Igual que en .pais
  function getFlag(jid) {
    const numero = jid.replace(/[^0-9]/g, "");
    const keys = Object.keys(flagMap).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (numero.startsWith(k)) return flagMap[k];
    }
    return "🌐";
  }

  let texto = `*!  MENCION GENERAL  !*\n`;
  texto += `   *PARA ${participants.length} MIEMBROS* 🔔\n\n`;

  for (const user of participants) {
    const numero = user.id;
    const bandera = getFlag(numero);

    texto += `┊» ${bandera} @${numero.split("@")[0]}\n`;
  }

  await conn.sendMessage(m.chat, { react: { text: '🔔', key: m.key } });

  await conn.sendMessage(m.chat, {
    text: texto,
    mentions: participants.map(p => p.id)
  }, { quoted: m });
};

handler.customPrefix = /^\.?(todos)$/i;
handler.command = new RegExp();
handler.admin = true;
handler.group = true;

export default handler;