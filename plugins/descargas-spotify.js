import fetch from 'node-fetch';
import axios from 'axios';

const apis = {
  fallback: 'https://delirius-apiofc.vercel.app/'
};

const handler = async (m, { args, conn, command, prefix }) => {
  if (!args[0]) {
    let ejemplos = ['Adele Hello', 'Sia Unstoppable', 'Maroon 5 Memories', 'Karol G Provenza', 'Natalia Jiménez Creo en mí'];
    let random = ejemplos[Math.floor(Math.random() * ejemplos.length)];
    return conn.reply(m.chat, `⚠️ Ejemplo de uso: ${(prefix || '.') + command} ${random}`, m);
  }

  await conn.sendMessage(m.chat, { react: { text: '⏱', key: m.key } });

  const query = encodeURIComponent(args.join(' '));

  try {
    // Funciones para obtener datos y link de audio de cada API
    const fetchPrimary = async () => {
      const res = await fetch(`https://api.delirius.store/search/spotify?q=${query}`);
      const json = await res.json();
      if (!json.status || !json.data || json.data.length === 0) throw new Error('No hay resultados');
      const track = json.data[0];
      const dlRes = await fetch(`https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(track.url)}`)
        .then(r => r.json());
      if (!dlRes?.data?.url) throw new Error('No audio');
      return { track, audioUrl: dlRes.data.url };
    };

    const fetchFallback = async () => {
      const { data } = await axios.get(`${apis.fallback}search/spotify?q=${query}&limit=10`);
      if (!data.data || data.data.length === 0) throw new Error('No hay resultados en fallback');
      const track = data.data[0];
      // Intentar primera descarga
      try {
        const res1 = await fetch(`${apis.fallback}download/spotifydl?url=${encodeURIComponent(track.url)}`);
        const dl1 = await res1.json();
        if (dl1?.data?.url) return { track, audioUrl: dl1.data.url };
        throw new Error('No audio');
      } catch {
        const res2 = await fetch(`${apis.fallback}download/spotifydlv3?url=${encodeURIComponent(track.url)}`);
        const dl2 = await res2.json();
        if (dl2?.data?.url) return { track, audioUrl: dl2.data.url };
        throw new Error('No audio fallback');
      }
    };

    // Lanzar ambas APIs simultáneamente y quedarnos con la primera que devuelva audio
    const { track, audioUrl } = await Promise.any([fetchPrimary(), fetchFallback()]);

    // Enviar info
    const caption = `
╔═══『 SPOTIFY 🎶 』
║ ✦  Título: ${track.title}
║ ✦  Artista: ${track.artist}
║ ✦  Álbum: ${track.album || 'Desconocido'}
║ ✦  Duración: ${track.duration || 'Desconocida'}
║ ✦  Popularidad: ${track.popularity || 'N/A'}
║ ✦  Publicado: ${track.publish || 'N/A'}
║ ✦  Link: ${track.url}
╚═════════════════╝`;

    await conn.sendMessage(m.chat, { image: { url: track.image }, caption }, { quoted: m });
    await conn.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${track.title}.mp3` }, { quoted: m });
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

  } catch (e) {
    console.log(e);
    m.reply('❌ No se pudo obtener la canción.', m);
  }
};

handler.help = ['spotify <canción>'];
handler.tags = ['busqueda', 'descargas'];
handler.command = ['spotify'];

export default handler;