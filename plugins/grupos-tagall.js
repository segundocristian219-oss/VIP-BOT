import PhoneNumber from "libphonenumber-js";

const handler = async (m, { conn, participants, isAdmin, isOwner }) => {
  if (!m.isGroup) return;
  if (!isAdmin && !isOwner) return global.dfail?.('admin', m, conn);

  async function resolveNumber(id) {
    try {
      // Meta DS6 → resolver número real
      const info = await conn.onWhatsApp(id);
      if (info && info[0] && info[0].jid) {
        return info[0].jid.replace("@s.whatsapp.net", "");
      }
    } catch (e) {}
    return null;
  }

  function getFlagFromNumber(num) {
    try {
      const pn = PhoneNumber(num, { extract: true });
      if (!pn || !pn.country) return "🏳️";
      const code = pn.country;

      const isoFlags = {
        MX: "🇲🇽",
        AR: "🇦🇷",
        BO: "🇧🇴",
        BR: "🇧🇷",
        CL: "🇨🇱",
        CO: "🇨🇴",
        CR: "🇨🇷",
        CU: "🇨🇺",
        EC: "🇪🇨",
        ES: "🇪🇸",
        GT: "🇬🇹",
        HN: "🇭🇳",
        HT: "🇭🇹",
        NI: "🇳🇮",
        PA: "🇵🇦",
        PE: "🇵🇪",
        PY: "🇵🇾",
        SV: "🇸🇻",
        UY: "🇺🇾",
        US: "🇺🇸",
        VE: "🇻🇪"
      };

      return isoFlags[code] || "🌐";
    } catch (e) {
      return "🏳️";
    }
  }

  let texto = `📣 *MENCIÓN GLOBAL*\n\n`;

  let mentionList = [];

  for (const user of participants) {
    const realNum = await resolveNumber(user.id);  

    let flag = "🏳️";
    let num = "DESCONOCIDO";

    if (realNum) {
      num = realNum;
      flag = getFlagFromNumber(realNum);
    }

    texto += `${flag} @${num}\n`;
    mentionList.push(user.id);
  }

  await conn.sendMessage(m.chat, { react: { text: '🔔', key: m.key } });

  await conn.sendMessage(m.chat, {
    text: texto,
    mentions: mentionList
  }, { quoted: m });
};

handler.customPrefix = /^\.?(todos)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;

export default handler;