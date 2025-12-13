import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = ['217158512549931', '227045091090524', '44346191667392', '213022542930125', '207237071036575', '274135666176172']

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝑽𝑰𝑷 𝑩𝑶𝑻'
global.redes = 'https://whatsapp.com/channel/0029Vb70mFfATRSmOvzRWy1t'
global.botname = '𝑽𝑰𝑷 𝑩𝑶𝑻'
global.banner = 'https://cdn.russellxz.click/aeaf7fa8.jpeg'
global.packname = '𝑽𝑰𝑷 𝑩𝑶𝑻'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 Hernandez'
global.libreria = 'Baileys'
global.baileys = 'V 6.7.16'
global.vs = '2.2.0'
global.usedPrefix = '.'
global.user2 = '18'
global.sessions = '𝑽𝑰𝑷 𝑩𝑶𝑻'
global.jadi = '𝑽𝑰𝑷 𝑩𝑶𝑻'
global.yukiJadibts = true

global.namecanal = '𝑽𝑰𝑷 𝑩𝑶𝑻 𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝗈'
global.idcanal = '120363402177795471@newsletter'
global.idcanal2 = '120363402177795471@newsletter'
global.canal = 'https://whatsapp.com/channel/0029Vb70mFfATRSmOvzRWy1t'
global.canalreg = '120363402177795471@newsletter'

global.ch = {
  ch1: '120363402177795471@newsletter'
}

global.multiplier = 69
global.maxwarn = 2

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Se actualizo el 'config.js'"))
  import(`file://${file}?update=${Date.now()}`)
})
