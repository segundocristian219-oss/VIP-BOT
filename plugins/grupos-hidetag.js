import { generateWAMMessageFromContent, downloadContentFromMessage } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb = null
async function loadThumb() {
  if (thumb) return thumb
  try {
    const res = await fetch('https://cdn.russellxz.click/28a8569f.jpeg')
    thumb = Buffer.from(await res.arrayBuffer())
  } catch {
    thumb = null
  }
  return thumb
}

function unwrapMessage(m = {}) {
  let n = m
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message
  }
  return n
}

function getMessageText(m) {
  const msg = unwrapMessage(m.message) || {}
  return (
    m.text ||
    m?.msg?.caption ||
    msg?.extendedTextMessage?.text ||
    msg?.conversation ||
    ''
  )
}

async function downloadMedia(msg, type) {
  try {
    const stream = await downloadContentFromMessage(msg, type)
    const chunks = []
    for await (const c of stream) chunks.push(c)
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  await loadThumb()

  const fkontak = {
    key: {
      fromMe: false,
      participant: '0@s.whatsapp.net',
      id: 'notify'
    },
    message: {
      contactMessage: {
        displayName: 'Ángel Bot',
        jpegThumbnail: thumb
      }
    }
  }

  const content = getMessageText(m).trim()
  if (!/^\.?n(\s|$)/i.test(content)) return

  await conn.sendMessage(m.chat, { react: { text: '🗣️', key: m.key } })

  const users = [...new Set(participants.map(p => conn.decodeJid(p.id)))]

  const q = m.quoted ? unwrapMessage(m.quoted) : unwrapMessage(m)
  const qMsg = q?.message || {}
  const mtype = Object.keys(qMsg)[0] || ''
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mtype)

  const userText = content.replace(/^\.?n(\s|$)/i, '').trim()
  const originalCaption = (q?.msg?.caption || q?.text || '').trim()
  const finalCaption = userText || originalCaption || '🔊 Notificación'

  try {
    if (isMedia) {
      let buffer = null

      if (qMsg[mtype]) {
        const det = mtype.replace('Message', '').toLowerCase()
        buffer = await downloadMedia(qMsg[mtype], det)
      }

      if (!buffer && q.download) buffer = await q.download()

      const msg = { mentions: users }

      if (mtype === 'audioMessage') {
        msg.audio = buffer
        msg.mimetype = 'audio/mpeg'
        msg.ptt = false
        await conn.sendMessage(m.chat, msg, { quoted: fkontak })
        if (userText) {
          await conn.sendMessage(m.chat, { text: userText, mentions: users }, { quoted: fkontak })
        }
        return
      }

      if (mtype === 'imageMessage') {
        msg.image = buffer
        msg.caption = finalCaption
      } else if (mtype === 'videoMessage') {
        msg.video = buffer
        msg.caption = finalCaption
        msg.mimetype = 'video/mp4'
      } else if (mtype === 'stickerMessage') {
        msg.sticker = buffer
      }

      return await conn.sendMessage(m.chat, msg, { quoted: fkontak })
    }

    if (m.quoted && !isMedia) {
      const newMsg = conn.cMod(
        m.chat,
        generateWAMMessageFromContent(
          m.chat,
          { [mtype || 'extendedTextMessage']: qMsg[mtype] || { text: finalCaption } },
          { quoted: fkontak, userJid: conn.user.id }
        ),
        finalCaption,
        conn.user.id,
        { mentions: users }
      )
      return await conn.relayMessage(m.chat, newMsg.message, { messageId: newMsg.key.id })
    }

    return await conn.sendMessage(
      m.chat,
      { text: finalCaption, mentions: users },
      { quoted: fkontak }
    )
  } catch {
    return await conn.sendMessage(
      m.chat,
      { text: '🔊 Notificación', mentions: users },
      { quoted: fkontak }
    )
  }
}

handler.help = ["𝖭𝗈𝗍𝗂𝖿𝗒"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler