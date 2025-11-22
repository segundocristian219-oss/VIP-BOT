// =========================================================
//   SISTEMA COMPLETO DE DETECCIÓN DE FANTASMAS (72 HORAS)
//   - Registro de actividad (messageHandler)
//   - Comando .fantasmas / .fankick
//   - Auto-revisión cada 24h (si el chat activa autoFantasma)
// =========================================================

// ====================================
//  1. REGISTRADOR DE ACTIVIDAD
// ====================================
export async function messageHandler(m, { conn }) {
    if (!m.isGroup) return
    if (!m.sender) return
    if (m.sender === conn.user.jid) return

    const tiposValidos = [
        "conversation",
        "extendedTextMessage",
        "imageMessage",
        "videoMessage",
        "audioMessage",
        "stickerMessage",
        "documentMessage"
    ]

    let tipo = m.message ? Object.keys(m.message)[0] : null
    if (!tiposValidos.includes(tipo)) return

    // Crear usuario si no existe
    if (!global.db.data.users[m.sender])
        global.db.data.users[m.sender] = {}

    let user = global.db.data.users[m.sender]

    // Crear grupos si no existe
    if (!user.groups) user.groups = {}
    if (!user.groups[m.chat]) user.groups[m.chat] = {}

    // Guardar la hora del último mensaje
    user.groups[m.chat].lastMessage = Date.now()
}



// ====================================
//  2. COMANDO .FANTASMAS / .FANKICK
// ====================================
let handler = async (m, { conn, participants, command }) => {

    const HORAS = 72
    const INACTIVIDAD = HORAS * 60 * 60 * 1000
    const ahora = Date.now()

    let miembros = participants.map(v => v.id)
    let fantasmas = []

    for (let usuario of miembros) {

        // Ignorar al bot
        if (usuario === conn.user.jid) continue

        // Ignorar admins
        let p = participants.find(u => u.id === usuario)
        if (p?.admin || p?.isAdmin || p?.isSuperAdmin) continue

        let dataUser = global.db.data.users[usuario]
        let lastMsg = dataUser?.groups?.[m.chat]?.lastMessage || 0

        // Nunca habló → fantasma
        // O habló pero pasaron 72h
        if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) {
            fantasmas.push(usuario)
        }
    }

    if (fantasmas.length === 0) {
        return conn.reply(m.chat, "✨ No hay fantasmas en este grupo.", m)
    }

    // Expulsar fantasmas
    if (command === "fankick") {
        await conn.groupParticipantsUpdate(m.chat, fantasmas, "remove")
        return conn.reply(
            m.chat,
            `🔥 *Fantasmas eliminados:*\n${fantasmas.map(v => '@' + v.split('@')[0]).join('\n')}`,
            null,
            { mentions: fantasmas }
        )
    }

    // Mostrar lista
    let msg = `
👻 *FANTASMAS DETECTADOS (72H)*

Grupo: ${await conn.getName(m.chat)}
Miembros: ${miembros.length}

${fantasmas.map(v => '👻 @' + v.split('@')[0]).join('\n')}

Usa *.fankick* para eliminarlos.
`
    conn.reply(m.chat, msg, null, { mentions: fantasmas })
}



// Handler propiedades
handler.help = ['fantasmas', 'fankick']
handler.tags = ['group']
handler.command = /^(fantasmas|sider|verfantasmas|fankick)$/i
handler.admin = true

export default handler



// ====================================
//  3. AUTO-REVISIÓN CADA 24 HORAS
// ====================================

global.autoCheckRun = global.autoCheckRun || false

// Evita que se duplique
if (!global.autoCheckRun) {

    global.autoCheckRun = true

    setInterval(async () => {
        try {
            let chats = Object.keys(global.db.data.chats || {})

            for (let id of chats) {
                let chat = global.db.data.chats[id]
                if (!chat || !chat.autoFantasma) continue

                let metadata = await conn.groupMetadata(id).catch(() => null)
                if (!metadata) continue

                let participants = metadata.participants

                const HORAS = 72
                const INACTIVIDAD = HORAS * 60 * 60 * 1000
                const ahora = Date.now()

                let fantasmas = []

                for (let user of participants.map(v => v.id)) {

                    if (user === conn.user.jid) continue

                    let p = participants.find(x => x.id === user)
                    if (p?.admin || p?.isAdmin || p?.isSuperAdmin) continue

                    let dataUser = global.db.data.users[user]
                    let lastMsg = dataUser?.groups?.[id]?.lastMessage || 0

                    if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) {
                        fantasmas.push(user)
                    }
                }

                if (fantasmas.length === 0) continue

                let msg = `
👻 *AUTO-REVISIÓN DE FANTASMAS (72H)*

Grupo: ${await conn.getName(id)}

Fantasmas encontrados:
${fantasmas.map(v => '👻 @' + v.split('@')[0]).join('\n')}

Usa *.fankick* si quieres limpiar.`
                
                conn.sendMessage(id, { text: msg, mentions: fantasmas })
            }

        } catch (e) {}
    }, 24 * 60 * 60 * 1000) // Cada 24h
}