// comandos/ytmp4.js — YouTube -> VIDEO directo (Sky API) SIN selección
import axios from "axios";

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "Russellxz";

// Desactivar timeout y permitir grandes respuestas
axios.defaults.timeout = 0;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.maxContentLength = Infinity;

function isYouTube(url) {
  return /^https?:\/\//i.test(url) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}

function fmtDur(s) {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
}

async function callSkyYtVideo(url) {
  const endpoints = ["/api/download/yt.js", "/api/download/yt.php"];
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "X-API-Key": API_KEY,
    Accept: "application/json"
  };
  const params = { url, format: "video" };

  for (const ep of endpoints) {
    try {
      const r = await axios.get(`${API_BASE}${ep}`, { params, headers, validateStatus: () => true });
      if (r.status === 200 && r.data?.status === "true" && r.data.data?.video) {
        return { mediaUrl: r.data.data.video, meta: r.data.data };
      }
    } catch {}
  }
  throw new Error("No se pudo obtener el video de YouTube.");
}

const handler = async (msg, { conn, args, command }) => {
  const jid = msg.key.remoteJid;
  const url = args.join(" ").trim();
  const pref = global.prefixes?.[0] || ".";

  if (!url) {
    return conn.sendMessage(jid, { text: `✳️ Usa:\n${pref}${command} <url>\nEj: ${pref}${command} https://youtu.be/xxxxxx` }, { quoted: msg });
  }
  if (!isYouTube(url)) {
    return conn.sendMessage(jid, { text: "❌ URL de YouTube inválida." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(jid, { react: { text: "⏱️", key: msg.key } });

    const { mediaUrl, meta } = await callSkyYtVideo(url);
    const title = meta.title || "YouTube Video";
    const dur = meta.duration ? fmtDur(meta.duration) : "—";

    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼

✦ Título: ${title}
✦ Duración: ${dur}
✦ Source: api-sky.ultraplus.click
`;

    await conn.sendMessage(jid, { video: { url: mediaUrl }, mimetype: "video/mp4", caption }, { quoted: msg });
    await conn.sendMessage(jid, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("ytmp4 error:", err);
    await conn.sendMessage(jid, { text: `❌ ${err.message || "Error procesando el enlace."}` }, { quoted: msg });
    await conn.sendMessage(jid, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["ytmp4","ytv"];
export default handler;