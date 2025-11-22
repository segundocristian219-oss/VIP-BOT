let messageHandler = async (m, { conn }) => {
    if (!m.sender || !m.isGroup) return

    let userData = global.db.data.users[m.sender] || {}
    if (!userData.groups) userData.groups = {}

    userData.groups[m.chat] = {
        lastMessage: Date.now()
    }

    global.db.data.users[m.sender] = userData
}

let handler = async (m, { conn, text, participants, command }) => {
    const DIAS_INACTIVO = 3
    const tiempoInactivo = DIAS_INACTIVO * 24 * 60 * 60 * 1000
    const ahora = Date.now()

    let miembros = participants.map(v => v.id)
    let fantasmas = []
    
    for (let usuario of miembros) {
        let isBot = usuario === conn.user.jid
        if (isBot) continue

        let infoParticipante = participants.find(p => p.id === usuario)
        let esAdmin = infoParticipante?.admin || infoParticipante?.isAdmin || infoParticipante?.isSuperAdmin
        if (esAdmin) continue

        let dataUser = global.db.data.users[usuario]
        let dataGrupo = dataUser?.groups?.[m.chat]

        let ultimaActividad = dataGrupo?.lastMessage || 0

        if (ahora - ultimaActividad > tiempoInactivo) {
            fantasmas.push(usuario)
        }
    }

    if (fantasmas.length === 0) {
        return conn.reply(m.chat, `*[❗INFO❗]* Este grupo no tiene fantasmas.`, m)
    }

    if (command === 'fankick') {
        await conn.groupParticipantsUpdate(m.chat, fantasmas, 'remove')
        let eliminados = fantasmas.map(v => '@' + v.replace(/@.+/, '')).join('\n')
        return conn.reply(m.chat, `*Fantasmas eliminados:*\n${eliminados}`, null, { mentions: fantasmas })
    }

    let mensaje = `[ ⚠ 𝙍𝙀𝙑𝙄𝙎𝙄𝙊𝙉 𝙄𝙉𝘼𝘾𝙏𝙄𝙑𝘼 ⚠ ]\n\n`
    mensaje += `𝐆𝐑𝐔𝐏𝐎: ${await conn.getName(m.chat)}\n`
    mensaje += `𝐌𝐈𝐄𝐌𝐁𝐑𝐎𝐒: ${miembros.length}\n\n`
    mensaje += `⇲ 𝙁𝘼𝙉𝙏𝘼𝙎𝙈𝘼𝙎 𝘿𝙀 𝟑 𝘿𝙄𝘼𝙎 ⇱\n`
    mensaje += fantasmas.map(v => '  👻 @' + v.replace(/@.+/, '')).join('\n')
    mensaje += `\n\n*_Los usuarios que no hablen serán eliminados_*\n\n`
    mensaje += `🧹 Para eliminar fantasmas usa:\n.fankick`

    conn.reply(m.chat, mensaje, null, { mentions: fantasmas })
}

handler.help = ['fantasmas', 'fankick']
handler.tags = ['group']
handler.command = /^(verfantasmas|fantasmas|sider|fankick)$/i
handler.admin = true

export { messageHandler }
export default handler