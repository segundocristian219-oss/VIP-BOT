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

const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "mvwTRkY8iPpP"
const SKY_MIRROR = "https://api-sky-mirror.ultra.workers.dev"

const pending = {}
const cache = {}
const MAX_CONCURRENT = 3
let activeDownloads = 0
const downloadQueue = []

function safeUnlink(file) {
  if (!file) return
  try { fs.existsSync(file) && fs.unlinkSync(file) } catch {}
}

function fileSizeMB(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024)
}

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms))
}

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) {
    await new Promise(resolve => downloadQueue.push(resolve))
  }
  activeDownloads++
  try {
    return await task()
  } finally {
    activeDownloads--
    if (downloadQueue.length) downloadQueue.shift()()
  }
}

async function downloadToFile(url, filePath, timeout = 40000, retry = 3) {
  for (let attempt = 0; attempt < retry; attempt++) {
    try {
      const res = await axios.get(url, {
        responseType: "stream",
        timeout,
        headers: { "User-Agent": "Mozilla/5.0 (WhatsAppBot)" }
      })

      await streamPipe(res.data, fs.createWriteStream(filePath))

      if (fs.existsSync(filePath) && fileSizeMB(filePath) > 0.1) {
        return filePath
      }
    } catch {}

    if (attempt < retry - 1) await wait(1000 * Math.pow(2, attempt))
  }
  throw new Error("Descarga fallida tras múltiples intentos")
}

async function skyRequest(videoUrl, format) {
  const urls = [
    `${SKY_BASE}/api/download/yt.php`,
    `${SKY_MIRROR}/api/download/yt.php`
  ]

  for (const base of urls) {
    try {
      const { data } = await axios.get(base, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout: 15000
      })

      const result = data?.data || data
      const url =
        result?.audio ||
        result?.video ||
        result?.url ||
        result?.download

      if (url && url.startsWith("http")) return url
    } catch {}
  }
  return null
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

async function prepareFormats(videoUrl, id) {
  cache[id] = { timestamp: Date.now(), files: {} }

  const formats = [
    { key: "audio", format: "audio", ext: "mp3" },
    { key: "video", format: "video", ext: "mp4" },
    { key: "audioDoc", format: "audio", ext: "mp3" },
    { key: "videoDoc", format: "video", ext: "mp4" }
  ]

  for (const f of formats) {
    try {
      const mediaUrl = await skyRequest(videoUrl, f.format)
      if (!mediaUrl) continue

      const unique = crypto.randomUUID()
      const file = path.join(TMP_DIR, `${unique}_${f.key}.${f.ext}`)

      await queueDownload(() => downloadToFile(mediaUrl, file))
      cache[id].files[f.key] = file
    } catch {}
  }
}
async function sendFile(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!fs.existsSync(filePath)) return

  const buffer = fs.readFileSync(filePath)
  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4"
  const fileName = `${title}.${type === "audio" ? "mp3" : "mp4"}`

  await conn.sendMessage(
    chatId,
    {
      [asDocument ? "document" : type]: buffer,
      mimetype,
      fileName
    },
    { quoted }
  )
}

async function handleDownload(conn, job, choice) {
  const mapping = {
    "👍": "audio",
    "❤️": "video",
    "📄": "audioDoc",
    "📁": "videoDoc"
  }

  const key = mapping[choice]
  if (!key) return

  const isDoc = key.endsWith("Doc")
  const type = key.startsWith("audio") ? "audio" : "video"

  let filePath

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const cached = cache[job.commandMsg.key.id]?.files?.[key]

      if (cached && fs.existsSync(cached)) {
        const size = fileSizeMB(cached).toFixed(1)

        await conn.sendMessage(
          job.chatId,
          {
            text: `⚡ Enviando ${type} (${size} MB)`
          },
          { quoted: job.commandMsg }
        )

        return await sendFile(
          conn,
          job.chatId,
          cached,
          job.title,
          isDoc,
          type,
          job.commandMsg
        )
      }

      await conn.sendMessage(
        job.chatId,
        { text: `⏳ Preparando ${type}...` },
        { quoted: job.commandMsg }
      )

      const mediaUrl = await skyRequest(job.videoUrl, type)
      if (!mediaUrl) throw new Error("No se obtuvo enlace válido")

      const ext = type === "audio" ? "mp3" : "mp4"
      const unique = crypto.randomUUID()
      const inFile = path.join(TMP_DIR, `${unique}_in.${ext}`)

      filePath = inFile

      await queueDownload(() => downloadToFile(mediaUrl, inFile))

      if (type === "audio" && path.extname(inFile) !== ".mp3") {
        filePath = await convertToMp3(inFile)
      }

      const sizeMB = fileSizeMB(filePath)
      if (sizeMB > 100) {
        throw new Error(`Archivo demasiado grande (${sizeMB.toFixed(1)}MB)`)
      }

      return await sendFile(
        conn,
        job.chatId,
        filePath,
        job.title,
        isDoc,
        type,
        job.commandMsg
      )
    } catch (err) {
      if (attempt === 2) {
        await conn.sendMessage(
          job.chatId,
          { text: `❌ Error: ${err.message}` },
          { quoted: job.commandMsg }
        )
      }
    } finally {
      safeUnlink(filePath)
    }
  }
}