import fetch from "node-fetch";

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ").trim();
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *Uso incorrecto del comando.*\n\n📌 *Ejemplo:* \n${pref}${command} aguila blanca`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: '⏳', key: msg.key }
  });

  try {
    // codificar la búsqueda
    const query = encodeURIComponent(text);
    // opcional: limitar longitud
    if (query.length > 200) {
      throw new Error("La búsqueda es demasiado larga.");
    }

    const apiUrl = `https://api.neoxr.eu/api/spotify-search?query=${query}&apikey=russellxz`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      // leer cuerpo del error para debug
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    // ver qué estructura devuelve data para debug
    if (!data) throw new Error("No llegó respuesta JSON.");
    if (typeof data !== "object") throw new Error("Respuesta inesperada del API.");
    if (!data.status) throw new Error("Status false en respuesta del API.");
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error("No se encontraron resultados.");
    }

    const song = data.data[0];

    const caption =
      `𖠁 *Título:* ${song.title}\n` +
      `𖠁 *Artista:* ${song.artist?.name || "Desconocido"}\n` +
      `𖠁 *Duración:* ${song.duration || "Desconocida"}\n` +
      `𖠁 *Enlace:* ${song.url}\n\n────────────\n🎧`;

    // Miniatura
    if (song.thumbnail) {
      await conn.sendMessage(chatId, {
        image: { url: song.thumbnail },
        caption,
        mimetype: "image/jpeg"
      }, { quoted: msg });
    } else {
      // si no imagen
      await conn.sendMessage(chatId, {
        text: caption
      }, { quoted: msg });
    }

    // Enviar audio
    if (!song.url) throw new Error("No hay enlace de audio disponible.");

    const audioRes = await fetch(song.url);
    if (!audioRes.ok) throw new Error("No se pudo descargar el audio.");

    const audioBuffer = await audioRes.arrayBuffer(); // o buffer dependiendo del entorno
    const buf = Buffer.from(audioBuffer);

    await conn.sendMessage(chatId, {
      audio: buf,
      mimetype: "audio/mpeg",
      fileName: `${song.title}.mp3`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .spotify búsqueda:", err);
    await conn.sendMessage(chatId, {
      text: `❌ *Error al buscar Spotify:*\n_${err.message}_`
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["splay"];
export default handler;