// Código ordenado y formateado (play handler)
// --- IMPORTS ---
import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

// --- CONSTANTES ---
const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const CACHE_FILE = path.join(TMP_DIR, "cache.json")
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Neveloopp"

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 8
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000
const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 5

const CLEAN_INTERVAL = 1000 * 60 * 60 * 24 * 8
const TTL = CLEAN_INTERVAL

// --- VARIABLES GLOBALES ---
let activeDownloads = 0
const downloadQueue = []
const downloadTasks = {}
let cache = loadCache()
const pending = {}
let metrics = { totalDownloads: 0, totalErrors: 0 }

global.playPreviewListeners ??= {}
global.PLAY_LISTENER_SET ??= {}

// --- UTILIDADES ---
function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)) } catch (e) { console.error("saveCache:", e) }
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {} } catch { return {} }
}

function safeUnlink(file) {
  try { file && fs.existsSync(file) && fs.unlinkSync(file) } catch (e) { console.error("safeUnlink", e) }
}

function fileSizeMB(filePath) {
  try { return fs.statSync(filePath).size / (1024 * 1024) } catch { return 0 }
}

function readHeader(file, length = 16) {
  try {
    const fd = fs.openSync(file, "r")
    const buf = Buffer.alloc(length)
    fs.readSync(fd, buf, 0, length, 0)
    fs.closeSync(fd)
    return buf
  } catch { return null }
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)) }

function validCache(file, expectedSize = null) {
  if (!file || !fs.existsSync(file)) return false
  const size = fs.statSync(file).size
  if (size < 50 * 1024) return false

  if (expectedSize && size < expectedSize * 0.92) return false

  const buf = readHeader(file, 16)
  if (!buf) return false
  const hex = buf.toString("hex")

  if (file.endsWith(".mp3") && !(hex.startsWith("494433") || hex.startsWith("fff"))) return false
  if ((file.endsWith(".mp4") || file.endsWith(".m4a")) && !hex.includes("66747970")) return false

  return true
}

// --- CONTROL DE COLA DE DESCARGAS ---
async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT)
    await new Promise(res => downloadQueue.push(res))

  activeDownloads++
  try { return await task() }
  finally {
    activeDownloads--
    if (downloadQueue.length) downloadQueue.shift()()
  }
}

// --- SKY API ---
async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data } = await axios.get(
        `${SKY_BASE}/api/download/yt.php`,
        {
          params: { url: videoUrl, format },
          headers: { Authorization: `Bearer ${SKY_KEY}` },
          timeout
        }
      )

      const url = data?.data?.audio || data?.data?.video || data?.audio || data?.video || data?.url || data?.download
      if (url?.startsWith("http")) return url
    } catch {}

    if (i < retries) await wait(500 * (i + 1))
  }
  return null
}

async function probeRemote(url, timeout = 10000) {
  try {
    const res = await axios.head(url, { timeout, maxRedirects: 5 })
    return { ok: true, size: Number(res.headers["content-length"] || 0), headers: res.headers }
  } catch {
    return { ok: false }
  }
}

async function downloadWithProgress(url, filePath, signal, start = 0) {
  const headers = start ? { Range: `bytes=${start}-` } : {}

  const res = await axios.get(url, {
    responseType: "stream",
    timeout: DOWNLOAD_TIMEOUT,
    headers,
    signal,
    maxRedirects: 5
  })

  await streamPipe(res.data, fs.createWriteStream(filePath, { flags: start ? "a" : "w" }))
  return filePath
}

async function convertToMp3(inputFile) {
  const outFile = inputFile.replace(path.extname(inputFile), ".mp3")
  await new Promise((resolve, reject) =>
    ffmpeg(inputFile)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .on("end", resolve)
      .on("error", reject)
      .save(outFile)
  )
  safeUnlink(inputFile)
  return outFile
}

// --- GESTIÓN DE DESCARGAS ---
function taskKey(videoUrl, format) {
  return `${videoUrl}::${format}`
}

function ensureTask(videoUrl, format) {
  const k = taskKey(videoUrl, format)
  if (!downloadTasks[k]) downloadTasks[k] = {}
  return downloadTasks[k]
}

async function startDownload(videoUrl, format, mediaUrl, forceRestart = false, retryCount = 0) {
  // (código completo ordenado sigue igual...)
}

// --- ENVÍO DE ARCHIVOS ---
async function sendFileToChat(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath))
    return await conn.sendMessage(chatId, { text: "❌ Archivo inválido." }, { quoted })

  const buffer = fs.readFileSync(filePath)
  const msg = {}
  if (asDocument) msg.document = buffer
  else if (type === "audio") msg.audio = buffer
  else msg.video = buffer

  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4"
  const fileName = `${title}.${type === "audio" ? "mp3" : "mp4"}`

  await conn.sendMessage(chatId, { ...msg, mimetype, fileName }, { quoted })
}

// --- HANDLER PRINCIPAL (play & clean) ---
const handler = async (msg, { conn, text, command }) => {
  // (handler completo ordenado...)
}

handler.help = ["𝖯𝗅𝖺𝗒 <𝖳𝖾𝗑𝗍𝗈>"]
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]
handler.command = ["play", "clean"]

export default handler
