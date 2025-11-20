import fs from "fs";
import path from "path";

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

function findParticipantByDigits(parts = [], digits = "") {
  if (!digits) return null;
  return (
    parts.find(
      (p) =>
        DIGITS(p?.id || "") === digits ||
        DIGITS(p?.jid || "") === digits
    ) || null
  );
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;

  const senderRaw = msg.key.participant || msg.key.remoteJid;
  const senderNum = DIGITS(
    typeof msg.realJid === "string" ? msg.realJid : senderRaw
  );

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : [];

  const botRaw = conn.user?.id || "";
  const botNum = DIGITS(botRaw.split(":")[0]);

  let metadata = await conn.groupMetadata(chatId);
  const participantes = Array.isArray(metadata?.participants)
    ? metadata.participants
    : [];

  const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid)
    ? ctx.mentionedJid
    : [];
  const quotedJid = ctx.participant || null;

  const targetDigits = new Set(
    [
      ...mentioned.map((j) => DIGITS(j)),
      quotedJid ? DIGITS(quotedJid) : "",
    ].filter(Boolean)
  );

  const resultados = [];
  const mentionsOut = [];

  for (const d of targetDigits) {
    if (d === senderNum) {
      resultados.push(`⚠️ No puedes expulsarte a ti mismo (@${d}).`);
      continue;
    }

    if (d === botNum) {
      resultados.push(`⚠️ No puedo expulsarme a mí (@${d}).`);
      continue;
    }

    const targetP = findParticipantByDigits(participantes, d);
    if (!targetP) {
      resultados.push(`❌ No encontré al usuario @${d} en este grupo.`);
      continue;
    }

    const targetGroupId = targetP.id || targetP.jid;

    const isTargetOwner =
      Array.isArray(owners) && owners.some(([id]) => id === d);

    if (isTargetOwner) {
      resultados.push(`⚠️ No se puede expulsar a @${d} (owner).`);
      continue;
    }

    try {
      await conn.groupParticipantsUpdate(chatId, [targetGroupId], "remove");
      resultados.push(`✅ Usuario @${d} expulsado.`);
      mentionsOut.push(targetGroupId);
    } catch (err) {
      resultados.push(`❌ Error al expulsar a @${d}.`);
      mentionsOut.push(targetGroupId);
    }
  }

  await conn.sendMessage(
    chatId,
    { text: resultados.join("\n"), mentions: mentionsOut },
    { quoted: msg }
  );

  await conn.sendMessage(chatId, { react: { text: "👢", key: msg.key } }).catch(() => {});
};

handler.command = ["kick"];
handler.admin = true;
handler.group = true;

export default handler;