import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = ['217158512549931', '245573982662762', '44346191667392', '213022542930125', '25271637938398', '274135666176172']

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻'
global.redes = 'https://whatsapp.com/channel/0029Vb70mFfATRSmOvzRWy1t'
global.botname = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻'
global.banner = 'https://cdn.russellxz.click/0511ac06.jpeg'
global.packname = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 Hernandez'
global.libreria = 'Baileys'
global.baileys = 'V 6.7.16'
global.vs = '2.2.0'
global.usedPrefix = '.'
global.user2 = '18'
global.sessions = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻'
global.jadi = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻'
global.yukiJadibts = true

global.namecanal = '𝑺𝑯𝑨𝑫𝑶𝑾 𝑩𝑶𝑻 𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝗈'
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
