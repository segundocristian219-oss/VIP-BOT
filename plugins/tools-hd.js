import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const pref   = global.prefixes?.[0] || '.';

  const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted    = quotedCtx?.quotedMessage;
  const imageMsg  = quoted?.imageMessage || msg.message?.imageMessage;

  if (!imageMsg) {
    return conn.sendMessage(chatId, {
      text: `☁️ Responde a una *imagen* Para mejorar la calidad`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, { react: { text: '🧪', key: msg.key } });

  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const stream = await downloadContentFromMessage(imageMsg, 'image');
    const tmpFile = path.join(tmpDir, `${Date.now()}_hd.jpg`);
    const ws = fs.createWriteStream(tmpFile);
    for await (const chunk of stream) ws.write(chunk);
    ws.end();
    await new Promise(resolve => ws.on('finish', resolve));

    const uploadForm = new FormData();
    uploadForm.append('file', fs.createReadStream(tmpFile));
    const up = await axios.post('https://cdn.russellxz.click/upload.php', uploadForm, {
      headers: uploadForm.getHeaders()
    });
    fs.unlinkSync(tmpFile);
    if (!up.data?.url) throw new Error('No se obtuvo URL al subir al CDN.');
    const imageUrl = up.data.url;

    const API_KEY    = 'russellxz';
    const REMINI_URL = 'https://api.neoxr.eu/api/remini';
    const rem = await axios.get(
      `${REMINI_URL}?image=${encodeURIComponent(imageUrl)}&apikey=${API_KEY}`
    );
    if (!rem.data?.status || !rem.data.data?.url) {
      throw new Error('La API no devolvió URL de imagen mejorada.');
    }

    await conn.sendMessage(chatId, {
      image: { url: rem.data.data.url },
      caption: ''
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

  } catch (e) {
    console.error('❌ Error en comando .hd:', e);
    await conn.sendMessage(chatId, {
      text: `❌ *Error:* ${e.message}`
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
  }
};

handler.command = ['hd'];
handler.help    = ['𝖧𝖽'];
handler.tags    = ['𝖳𝖮𝖮𝖫𝖲'];

export default handler;