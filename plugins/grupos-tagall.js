import { parsePhoneNumber } from "libphonenumber-js";

const handler = async (m, { conn }) => {

  if (!m.isGroup) return m.reply("❌ Este comando solo funciona en grupos.");

  const group = await conn.groupMetadata(m.chat);
  const participants = group.participants || [];

  const flags = {
    MX: "🇲🇽", CO: "🇨🇴", AR: "🇦🇷", PE: "🇵🇪",
    CL: "🇨🇱", VE: "🇻🇪", US: "🇺🇸", BR: "🇧🇷",
    EC: "🇪🇨", GT: "🇬🇹", SV: "🇸🇻", HN: "🇭🇳",
    NI: "🇳🇮", CR: "🇨🇷", PA: "🇵🇦", UY: "🇺🇾",
    PY: "🇵🇾", BO: "🇧🇴", DO: "🇩🇴", PR: "🇵🇷",
    ES: "🇪🇸", UNK: "🏳️"
  };

  function getFlag(jid) {
    let num = jid.split("@")[0];
    if (!num.startsWith("+")) num = "+" + num;

    try {
      const parsed = parsePhoneNumber(num);
      return parsed?.country ? flags[parsed.country] || flags.UNK : flags.UNK;
    } catch {
      return flags.UNK;
    }
  }

  let texto = `📢 *MENCIÓN GLOBAL*\n\n`;
  const mentions = [];

  for (let p of participants) {
    const jid = p.id;
    const number = jid.split("@")[0]; // 🔥 fuerza número real SIEMPRE
    const tag = "@" + number;

    const flag = getFlag(jid);

    texto += `${flag} ${tag}\n`;
    mentions.push(jid);
  }

  await conn.sendMessage(m.chat, {
    text: texto,
    mentions
  }, { quoted: m });

};

handler.command = ["todos"];
export default handler;