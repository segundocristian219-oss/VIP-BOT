import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const CACHE_FILE = path.join(TMP_DIR, "cache.json")
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Russellxz"
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 3
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000
const MAX_RETRIES = 3

// TTL y autoclean (8 días)
const CLEAN_INTERVAL = 1000 * 60 * 60 * 24 * 8 // 8 días
const TTL = CLEAN_INTERVAL

let activeDownloads = 0
const downloadQueue = []
const downloadTasks = {}        // { "<videoUrl>::audio": { status, promise, file, controller, meta } }
let cache = loadCache()
const pending = {}              // { "<previewId>": { chatId, videoUrl, title, commandMsg, sender, time, downloading, listener } }

// métricas simples
let metrics = { totalDownloads: 0, totalErrors: 0 }

/////////////////////// UTILIDADES ///////////////////////
function saveCache(){ try{ fs.writeFileSync(CACHE_FILE,JSON.stringify(cache)) }catch(e){console.error("saveCache:",e)} }
function loadCache(){ try{ return JSON.parse(fs.readFileSync(CACHE_FILE,"utf8"))||{} }catch{return{}} }
function safeUnlink(file){ try{ file && fs.existsSync(file) && fs.unlinkSync(file) }catch(e){console.error("safeUnlink",e)} }
function fileSizeMB(filePath){ try{return fs.statSync(filePath).size/(1024*1024)}catch{return 0} }
function readHeader(file,length=16){ try{ const fd=fs.openSync(file,"r"); const buf=Buffer.alloc(length); fs.readSync(fd,buf,0,length,0); fs.closeSync(fd); return buf}catch{return null} }
function wait(ms){ return new Promise(res=>setTimeout(res,ms)) }

function validCache(file,expectedSize=null){
  if(!file || !fs.existsSync(file)) return false
  const size = fs.statSync(file).size
  if(size<50*1024) return false
  if(expectedSize && size<expectedSize*0.92) return false
  const buf = readHeader(file,16)
  if(!buf) return false
  const hex = buf.toString("hex")
  if(file.endsWith(".mp3") && !(hex.startsWith("494433") || hex.startsWith("fff"))) return false
  if((file.endsWith(".mp4")||file.endsWith(".m4a")) && !hex.includes("66747970")) return false
  return true
}

async function queueDownload(task){
  if(activeDownloads>=MAX_CONCURRENT) await new Promise(res=>downloadQueue.push(res))
  activeDownloads++
  try{return await task()}finally{activeDownloads--; if(downloadQueue.length) downloadQueue.shift()() }
}

async function getSkyApiUrl(videoUrl, format, timeout=20000, retries=2){
  for(let i=0;i<=retries;i++){
    try{
      const {data} = await axios.get(`${SKY_BASE}/api/download/yt.php`,{
        params:{url:videoUrl,format},
        headers:{Authorization:`Bearer ${SKY_KEY}`},
        timeout
      })
      const url = data?.data?.audio || data?.data?.video || data?.audio || data?.video || data?.url || data?.download
      if(url?.startsWith("http")) return url
    }catch(e){ /* silent */ }
    if(i<retries) await wait(500*(i+1))
  }
  return null
}

async function probeRemote(url, timeout=10000){
  try{ const res = await axios.head(url,{timeout,maxRedirects:5}); return {ok:true,size:Number(res.headers["content-length"]||0),headers:res.headers} }catch{return {ok:false}}
}

async function downloadWithProgress(url,filePath,signal,start=0){
  const headers = start?{Range:`bytes=${start}-`}:{}
  const res = await axios.get(url,{responseType:"stream",timeout:DOWNLOAD_TIMEOUT,headers,signal,maxRedirects:5})
  // streamPipe cierra adecuadamente cuando el stream termina o cuando se aborta la señal.
  await streamPipe(res.data,fs.createWriteStream(filePath,{flags:start?"a":"w"}))
  return filePath
}

async function convertToMp3(inputFile){
  const outFile = inputFile.replace(path.extname(inputFile),".mp3")
  await new Promise((resolve,reject)=> ffmpeg(inputFile).audioCodec("libmp3lame").audioBitrate("128k").format("mp3").on("end",resolve).on("error",reject).save(outFile))
  safeUnlink(inputFile)
  return outFile
}

function taskKey(videoUrl, format){ return `${videoUrl}::${format}` }

function ensureTask(videoUrl, format){
  const k = taskKey(videoUrl,format)
  if(!downloadTasks[k]) downloadTasks[k]={}
  return downloadTasks[k]
}

async function startDownload(videoUrl, format, mediaUrl, forceRestart=false, retryCount=0){
  const k = taskKey(videoUrl,format)
  const tasks = ensureTask(videoUrl,format)
  if(tasks.status==="downloading") return tasks.promise
  if(!forceRestart && tasks.status==="done") return tasks.file

  const ext = format==="audio"?"mp3":"mp4"
  const tmpExt = format==="audio"?".audio.tmp":".video.tmp"
  const tmpFile = path.join(TMP_DIR,`${crypto.randomUUID()}${tmpExt}`)
  const outFile = tmpFile.replace(tmpExt, `.${ext}`)

  const controller = new AbortController()
  const info = {file:null,status:"downloading",controller,promise:null,meta:{tmpFile,outFile}}

  info.promise = (async ()=>{
    try{
      if(forceRestart){ safeUnlink(tasks.file); delete tasks.file }
      const probe = await probeRemote(mediaUrl)
      const expectedSize = probe.ok && probe.size
      // realizar descarga dentro de la cola
      await queueDownload(()=> downloadWithProgress(mediaUrl,tmpFile,controller.signal,0))
      // Si es audio y no tiene extensión mp3, convertir
      if(format==="audio"){
        // intentaremos convertir si tmpFile no es mp3 (server puede devolver mp3 directo con .tmp nombre)
        try{
          // si el tmp ya es mp3 por contenido, renombramos; else convertimos
          const hdr = readHeader(tmpFile,4)
          const hex = hdr ? hdr.toString("hex") : ""
          if(hex.startsWith("494433") || hex.startsWith("fff")){
            fs.renameSync(tmpFile,outFile)
            info.file = outFile
          } else {
            // convertir
            info.file = await convertToMp3(tmpFile)
          }
        }catch(e){
          // en caso de fallo de conversión, intenta usar tmpFile directamente si parece mp3
          if(fs.existsSync(tmpFile)) info.file = tmpFile
          else throw e
        }
      } else {
        // video: renombrar tmpFile a outFile
        try{ fs.renameSync(tmpFile,outFile); info.file = outFile }catch(e){ info.file = tmpFile }
      }

      if(!validCache(info.file,expectedSize)){
        safeUnlink(info.file)
        if(retryCount<MAX_RETRIES) return await startDownload(videoUrl,format,mediaUrl,true,retryCount+1)
        throw new Error("Archivo inválido después de descargar")
      }
      if(fileSizeMB(info.file)>MAX_FILE_MB){ safeUnlink(info.file); throw new Error("Archivo demasiado grande") }
      info.status="done"
      tasks.status="done"
      tasks.file=info.file
      return info.file
    }catch(err){
      info.status="error"
      tasks.status="error"
      safeUnlink(info.file)
      safeUnlink(tmpFile)
      metrics.totalErrors++
      if(retryCount<MAX_RETRIES && !controller.signal.aborted) return await startDownload(videoUrl,format,mediaUrl,true,retryCount+1)
      throw err
    }
  })()

  tasks.promise = info.promise
  downloadTasks[k] = info
  return info.promise
}

async function sendFileToChat(conn,chatId,filePath,title,asDocument,type,quoted){
  if(!validCache(filePath)) return await conn.sendMessage(chatId,{text:"❌ Archivo inválido."},{quoted})
  const buffer = fs.readFileSync(filePath)
  const msg = {}
  if(asDocument) msg.document = buffer
  else if(type==="audio") msg.audio = buffer
  else msg.video = buffer
  const mimetype = type==="audio"?"audio/mpeg":"video/mp4"
  const fileName = `${title}.${type==="audio"?"mp3":"mp4"}`
  await conn.sendMessage(chatId,{...msg,mimetype,fileName},{quoted})
}

// ==================== HANDLER PRINCIPAL ====================

const handler = async(msg,{conn,text,command})=>{
  const pref = global.prefixes?.[0]||"."
  if(command==="clean"){
    // limpieza forzada segura
    let deleted=0,freed=0
    Object.values(cache).forEach(data=>Object.values(data.files||{}).forEach(f=>{ if(f && fs.existsSync(f)){freed+=fs.statSync(f).size; safeUnlink(f); deleted++}}))
    fs.readdirSync(TMP_DIR).forEach(f=>{ const full=path.join(TMP_DIR,f); if(fs.existsSync(full)){freed+=fs.statSync(full).size; safeUnlink(full); deleted++} })
    cache = {}
    saveCache()
    return await conn.sendMessage(msg.chat,{text:`🧹 Limpieza PRO\nEliminados: ${deleted}\nEspacio liberado: ${(freed/1024/1024).toFixed(2)} MB`},{quoted:msg})
  }

  if(!text?.trim()) return await conn.sendMessage(msg.key.remoteJid,{text:`✳️ Usa:\n${pref}play <término>\nEj: ${pref}play bad bunny diles`},{quoted:msg})

  try{ await conn.sendMessage(msg.key.remoteJid,{react:{text:"🕒",key:msg.key}}) } catch{}

  let res
  try{ res = await yts(text) } catch{return await conn.sendMessage(msg.key.remoteJid,{text:"❌ Error al buscar video."},{quoted:msg})}
  const video = res.videos?.[0]
  if(!video) return await conn.sendMessage(msg.key.remoteJid,{text:"❌ Sin resultados."},{quoted:msg})

  const { url:videoUrl, title, timestamp:duration, views, author, thumbnail } = video
  const caption = `🎵 Título: ${title}\n🕑 Duración: ${duration}\n👁️‍🗨️ Vistas: ${(views||0).toLocaleString()}\n🎤 Artista: ${author?.name||author||"Desconocido"}\n🌐 Link: ${videoUrl}\n\n📥 Reacciona:\n☛ 👍 Audio MP3\n☛ ❤️ Video MP4\n☛ 📄 Audio Doc\n☛ 📁 Video Doc`

  const preview = await conn.sendMessage(msg.key.remoteJid,{image:{url:thumbnail},caption},{quoted:msg})
  // almacenar pending con timestamp
  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    sender: msg.key.participant || msg.participant,
    downloading: false,
    time: Date.now(),
    listener: null // luego se asigna
  }

  // Guardar en cache minimal (time) para que el autoclean lo sepa
  cache[videoUrl] = cache[videoUrl] || { time: Date.now(), files: {} }
  saveCache()

  try{ await conn.sendMessage(msg.key.remoteJid,{react:{text:"✅",key:msg.key}}) } catch{}

  // Listener aislado por preview (para evitar cruces)
  const previewId = preview.key.id
  const listener = async ev => {
    for(const m of ev.messages||[]){
      try{
        // reacciones (reactionMessage)
        const react = m.message?.reactionMessage
        if(react){
          const job = pending[react.key?.id]
          if(job && !job.downloading && (react.sender || m.key.participant) === job.sender){
            job.downloading = true
            await conn.sendMessage(job.chatId,{text:`⏳ Descargando ${{"👍":"audio","❤️":"video","📄":"audioDoc","📁":"videoDoc"}[react.text] || "archivo"}...`},{quoted:job.commandMsg})
            try{ await handleDownload(conn,job,react.text) }finally{ job.downloading = false }
            // Si la entrega terminó, borrar pending y remover listener
            if(pending[react.key?.id]){
              // mantener por si varios archivos piden (pero normalmente borrar)
            }
          }
        }

        // respuestas citadas (extendedTextMessage)
        const context = m.message?.extendedTextMessage?.contextInfo
        const citado = context?.stanzaId
        const texto = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").toLowerCase().trim()
        if(citado && pending[citado]){
          const job = pending[citado]
          const audioKeys = ["1","audio","4","audiodoc"]
          const videoKeys = ["2","video","3","videodoc"]
          if(audioKeys.includes(texto)){
            await conn.sendMessage(m.key.remoteJid,{text:"🎶 Descargando audio..."},{quoted:m})
            await downloadAudio(conn,job,["4","audiodoc"].includes(texto),m)
          } else if(videoKeys.includes(texto)){
            await conn.sendMessage(m.key.remoteJid,{text:"🎥 Descargando video..."},{quoted:m})
            await downloadVideo(conn,job,["3","videodoc"].includes(texto),m)
          } else {
            await conn.sendMessage(m.key.remoteJid,{text:"⚠️ Opciones válidas: 1/audio,4/audiodoc → audio; 2/video,3/videodoc → video"},{quoted:m})
          }
        }
      }catch(e){ console.error("listener error:",e) }
    }
  }

  // registrar listener y guardar referencia para poder removerlo
  pending[previewId].listener = listener
  conn.ev.on("messages.upsert", listener)

  // Auto-remover el listener y pending si no hay interacción en TTL (8 días)
  setTimeout(()=>{
    if(pending[previewId]){
      try{ conn.ev.off("messages.upsert", pending[previewId].listener) }catch(e){}
      delete pending[previewId]
      // console.log(`pending ${previewId} expirado y listener removido`)
    }
  }, TTL)
}

// ==================== DESCARGAS/LOGICA ====================

async function handleDownload(conn,job,choice){
  const mapping={"👍":"audio","❤️":"video","📄":"audioDoc","📁":"videoDoc"}
  const key = mapping[choice]
  if(!key) return
  const isDoc = key.endsWith("Doc")
  await conn.sendMessage(job.chatId,{text:`⏳ Descargando ${isDoc?"documento":key}…`},{quoted:job.commandMsg})
  if(key.startsWith("audio")) await downloadAudio(conn,job,isDoc,job.commandMsg)
  else await downloadVideo(conn,job,isDoc,job.commandMsg)
}

async function downloadAudio(conn,job,asDocument,quoted){
  const { chatId, videoUrl, title } = job
  // obtener url desde Sky API
  const data = await getSkyApiUrl(videoUrl,"audio")
  if(!data) return conn.sendMessage(chatId,{text:"❌ No se pudo obtener audio."},{quoted})

  const k = taskKey(videoUrl,"audio")
  try{
    // si ya existe tarea/archivo, compartir
    const tasks = ensureTask(videoUrl,"audio")
    let file
    if(tasks.status==="done" && tasks.file && fs.existsSync(tasks.file)){
      file = tasks.file
    } else {
      // iniciar descarga
      metrics.totalDownloads++
      const started = startDownload(videoUrl,"audio",data,false,0)
      // marca de descarga activa
      const info = await started
      file = info
    }

    if(!file || !fs.existsSync(file)) return conn.sendMessage(chatId,{text:"❌ Falló la descarga final."},{quoted})
    if(fileSizeMB(file)>MAX_FILE_MB){ return conn.sendMessage(chatId,{text:"❌ Archivo >99MB"},{quoted}) }

    // enviar
    await sendFileToChat(conn,chatId,file,title,asDocument,"audio",quoted)

    // actualizar cache (guardar time + ruta)
    cache[videoUrl] = cache[videoUrl] || { time: Date.now(), files: {} }
    cache[videoUrl].time = Date.now()
    cache[videoUrl].files.audio = file
    saveCache()

    // borrar pending y remover listener
    cleanupPendingByJob(job)
  }catch(err){
    console.error("downloadAudio error:",err)
    await conn.sendMessage(chatId,{text:"❌ Error al descargar audio."},{quoted})
  }
}

async function downloadVideo(conn,job,asDocument,quoted){
  const { chatId, videoUrl, title } = job
  const data = await getSkyApiUrl(videoUrl,"video")
  if(!data) return conn.sendMessage(chatId,{text:"❌ No se pudo obtener video."},{quoted})

  const k = taskKey(videoUrl,"video")
  try{
    const tasks = ensureTask(videoUrl,"video")
    let file
    if(tasks.status==="done" && tasks.file && fs.existsSync(tasks.file)){
      file = tasks.file
    } else {
      metrics.totalDownloads++
      const started = startDownload(videoUrl,"video",data,false,0)
      const info = await started
      file = info
    }

    if(!file || !fs.existsSync(file)) return conn.sendMessage(chatId,{text:"❌ Falló la descarga final."},{quoted})
    if(fileSizeMB(file)>MAX_FILE_MB){ return conn.sendMessage(chatId,{text:"❌ Archivo >99MB"},{quoted}) }

    await sendFileToChat(conn,chatId,file,title,asDocument,"video",quoted)

    cache[videoUrl] = cache[videoUrl] || { time: Date.now(), files: {} }
    cache[videoUrl].time = Date.now()
    cache[videoUrl].files.video = file
    saveCache()

    cleanupPendingByJob(job)
  }catch(err){
    console.error("downloadVideo error:",err)
    await conn.sendMessage(chatId,{text:"❌ Error al descargar video."},{quoted})
  }
}

// eliminar pending y remover listener con seguridad
function cleanupPendingByJob(job){
  try{
    // buscar la key en pending por igualdad simple
    for(const id of Object.keys(pending)){
      const p = pending[id]
      if(p && p.chatId===job.chatId && p.videoUrl===job.videoUrl && (p.sender===job.sender || !job.sender)){
        try{ if(p.listener) connGlobalOff(p.listener) }catch(e){}
        delete pending[id]
      }
    }
  }catch(e){ console.error("cleanupPendingByJob",e) }
}

// helper: desconectar listener usando conn global (no queremos pasar conn por todos lados)
function connGlobalOff(listener){
  try{ global.conn && global.conn.ev.off("messages.upsert", listener) }catch(e){ /* fallback silencio */ }
}

// ==================== AUTO CLEAN ====================
function autoClean(){
  const now = Date.now()
  let deleted = 0
  let freed = 0

  // LIMPIAR CACHE VIEJO
  for (const vid of Object.keys(cache)){
    const entry = cache[vid]
    if (!entry || !entry.time || now - entry.time > TTL) {
      if (entry && entry.files) {
        for (const f of Object.values(entry.files)) {
          if (f && fs.existsSync(f)) {
            try{ freed += fs.statSync(f).size }catch{}
            safeUnlink(f)
            deleted++
          }
        }
      }
      delete cache[vid]
    }
  }

  // LIMPIAR TMP VIEJO (respetando archivos en descarga)
  const files = fs.readdirSync(TMP_DIR)
  const activeTmpFiles = new Set()
  Object.values(downloadTasks).forEach(t => {
    try{
      if(t && t.meta && t.meta.tmpFile) activeTmpFiles.add(t.meta.tmpFile)
      if(t && t.file) activeTmpFiles.add(t.file)
    }catch(e){}
  })

  for (const f of files) {
    const full = path.join(TMP_DIR, f)
    try {
      const stat = fs.statSync(full)
      if (now - stat.mtimeMs > TTL && !activeTmpFiles.has(full)) {
        try{ freed += stat.size }catch{}
        safeUnlink(full)
        deleted++
      }
    } catch {}
  }

  // LIMPIAR pending viejo (sin interacción)
  for (const id of Object.keys(pending)){
    const p = pending[id]
    if (!p || (p.time && now - p.time > TTL)){
      try{ if(p.listener) connGlobalOff(p.listener) }catch(e){}
      delete pending[id]
    }
  }

  saveCache()
  console.log(`AutoClean → borrados ${deleted} archivos, ${(freed/1024/1024).toFixed(2)} MB liberados.`)
}

// ejecutar autoclean y exponer en global para tests/debug
setInterval(autoClean, CLEAN_INTERVAL)
global.autoclean = autoClean

// Exponer handler y utilidades (opcional)
handler.help=["𝖯𝗅𝖺𝗒 <𝖳𝖾𝗑𝗍𝗈>"]
handler.tags=["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]
handler.command=["play","clean"]
export default handler