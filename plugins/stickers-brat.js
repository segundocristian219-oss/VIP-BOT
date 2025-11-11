const handler = async (m, { conn, text }) => {
  // Si no hay texto, intentamos usar el del mensaje citado
  if (!text && m.quoted?.text) {
    text = m.quoted.text
  }

  if (!text) {
    return m.reply(`☁️ *𝙰𝚐𝚛𝚎𝚐𝚊 𝚝𝚎𝚡𝚝𝚘 𝚘 𝚛𝚎𝚜𝚙𝚘𝚗𝚍𝚎 𝚊 𝚞𝚗 𝚖𝚎𝚗𝚜𝚊𝚓𝚎 𝚙𝚊𝚛𝚊 𝚌𝚛𝚎𝚊𝚛 𝚎𝚕 𝚜𝚝𝚒𝚌𝚔𝚎𝚛*.`)
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } })

    const url = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`
    await conn.sendMessage(
      m.chat,
      {
        sticker: { url },
        packname: "",
        author: "",
      },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } })
  } catch (e) {
    console.error(e)
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
    conn.reply(m.chat, '❌ *𝙴𝚛𝚛𝚘𝚛 𝙰𝚕 𝙶𝚎𝚗𝚎𝚛𝚊𝚛 𝚎𝚕 𝚂𝚝𝚒𝚌𝚔𝚎𝚛*.', m)
  }
}

handler.command = /^brat$/i
handler.help = ["brat <texto>"]
handler.tags = ["sticker"]

export default handler