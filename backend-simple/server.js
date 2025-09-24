const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Connection
const MONGO_URI = "mongodb+srv://2236001057_db_user:aoJchBA3n43VTWEW@cluster0.zuxzkfl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Conectado a MongoDB Atlas"))
.catch(err => console.error("Error de conexión:", err));

// Models
const userSchema = new mongoose.Schema({
  nombre: String,
  email: { type: String, unique: true },
  password: String,
  rol: { type: String, default: "repartidor" }
})

const tiendaSchema = new mongoose.Schema({
  nombre: { type: String, unique: true },
  activa: { type: Boolean, default: true },
  orden: { type: Number, default: 999 }
})

const registroSchema = new mongoose.Schema({
  tienda: String,
  fecha: Date,
  kilos: { type: Number, default: 0 },
  cambios: { type: Number, default: 0 },
  frijoles: { type: Number, default: 0 },
  salsas: { type: Number, default: 0 },
  totopos: { type: Number, default: 0 },
  observaciones: { type: String, default: "" },
  usuario: String
}, { timestamps: true })

// Add compound index for tienda + fecha combination
registroSchema.index({ tienda: 1, fecha: 1 }, { unique: true })

// Nota Schema
const notaSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  contenido: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  creadoPor: { type: String, required: true },
  nombreUsuario: String
}, { timestamps: true })

const User = mongoose.model("User", userSchema)
const Tienda = mongoose.model("Tienda", tiendaSchema)
const Registro = mongoose.model("Registro", registroSchema)
const Nota = mongoose.model("Nota", notaSchema)

// Initialize data
async function initializeData() {
  try {
    // Create admin if not exists
    const adminExists = await User.findOne({ email: "admin@comal.com" })
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10)
      await User.create({
        nombre: "Administrador",
        email: "admin@comal.com",
        password: hashedPassword,
        rol: "admin"
      })
      console.log("✓ Admin created")
    }

    // Create tiendas if not exist (only create new ones, don't modify existing)
    const TIENDAS = [
      'GOYITA', 'SAUCILLO', 'SAGRADO', 'SANTA ANITA', 'SAN JUDAS', 
      'ANEXO', 'GUERA', 'CHUNDE', 'PIEDRERA', 'JUANJO', 'ALAN', 
      'DIANA', 'PORVENIR', 'ESCUELA', 'PUENYE', 'CLIENTE', 
      'PINTADA', 'DON RICHARD', 'ALI', 'EDIEL', 'LETTY', 
      'ROSTI', 'NUEVA', 'PONY', 'TAQUERA', 'PATY', 'GORDITAS', 
      'DON CHAVA', 'ESQUINA'
    ]

    for (let i = 0; i < TIENDAS.length; i++) {
      const nombre = TIENDAS[i]
      const exists = await Tienda.findOne({ nombre })
      if (!exists) {
        // Create new tiendas with correct order
        await Tienda.create({ nombre, activa: true, orden: i + 1 })
      } else {
        // Update existing tiendas with correct order if they don't have one
        if (exists.orden === undefined || exists.orden === 999) {
          await Tienda.findByIdAndUpdate(exists._id, { orden: i + 1 })
        }
      }
    }
    console.log("✓ Tiendas initialized")
  } catch (error) {
    console.error("Init error:", error)
  }
}

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")
    if (!token) {
      return res.status(401).json({ success: false, message: "No token" })
    }
    const decoded = jwt.verify(token, "comal_secret_2024")
    req.user = decoded
    next()
  } catch (error) {
    res.status(401).json({ success: false, message: "Token invalid" })
  }
}

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() })
})

// Test endpoint for mobile app connectivity
app.get("/api/auth/test", (req, res) => {
  res.json({ success: true, message: "Server is running" })
})

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nombre, email, password } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      rol: "repartidor"
    })
    res.json({ success: true, message: "Usuario creado" })
  } catch (error) {
    res.status(400).json({ success: false, message: "Error al crear usuario" })
  }
})

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" })
    }
    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, email: user.email, rol: user.rol },
      "comal_secret_2024",
      { expiresIn: "24h" }
    )
    res.json({ success: true, token, user: { nombre: user.nombre, rol: user.rol } })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error del servidor" })
  }
})

// Get precios
app.get("/api/registros/precios", auth, (req, res) => {
  const precios = { kilos: 18, frijoles: 14, salsas: 13, totopos: 18, cambios: 0 }
  res.json({ success: true, precios })
})

// Update precios
app.put("/api/registros/precios", auth, (req, res) => {
  const { kilos, frijoles, salsas, totopos, cambios } = req.body
  const precios = { kilos, frijoles, salsas, totopos, cambios: cambios || 0 }
  res.json({ success: true, precios })
})

// Save ruta
app.post("/api/registros/save-ruta", auth, async (req, res) => {
  try {
    const { fecha, datos } = req.body
    
    if (!fecha || !datos || Object.keys(datos).length === 0) {
      return res.status(400).json({ success: false, message: "Fecha y datos son requeridos" })
    }
    
    const savedCount = []
    const errors = []
    
    for (const [tiendaNombre, tiendaData] of Object.entries(datos)) {
      try {
        await Registro.findOneAndUpdate(
          { tienda: tiendaNombre, fecha: new Date(fecha) },
          {
            tienda: tiendaNombre,
            fecha: new Date(fecha),
            kilos: parseFloat(tiendaData.kilos) || 0,
            cambios: parseFloat(tiendaData.cambios) || 0,
            frijoles: parseFloat(tiendaData.frijoles) || 0,
            salsas: parseFloat(tiendaData.salsas) || 0,
            totopos: parseFloat(tiendaData.totopos) || 0,
            observaciones: tiendaData.observaciones || "",
            usuario: req.user.nombre
          },
          { upsert: true, new: true }
        )
        savedCount.push(tiendaNombre)
      } catch (error) {
        errors.push(`Error en ${tiendaNombre}: ${error.message}`)
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Errores al guardar: ${errors.join(', ')}`,
        saved: savedCount.length,
        errors: errors.length
      })
    }
    
    res.json({ success: true, message: `Ruta guardada para ${fecha}`, saved: savedCount.length })
  } catch (error) {
    console.error('Error saving ruta:', error)
    res.status(500).json({ success: false, message: "Error interno del servidor" })
  }
})

// Load ruta
app.get("/api/registros/load-ruta", auth, async (req, res) => {
  try {
    const { fecha } = req.query
    const registros = await Registro.find({
      fecha: { $gte: new Date(fecha), $lt: new Date(new Date(fecha).getTime() + 24*60*60*1000) }
    })
    
    const datos = {}
    registros.forEach(r => {
      datos[r.tienda] = {
        kilos: r.kilos,
        cambios: r.cambios,
        frijoles: r.frijoles,
        salsas: r.salsas,
        totopos: r.totopos,
        observaciones: r.observaciones || ""
      }
    })
    
    res.json({ success: true, fecha, datos })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al cargar" })
  }
})

// Get rutas existentes
app.get("/api/registros/rutas-existentes", auth, async (req, res) => {
  try {
    const rutas = await Registro.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ])
    
    const rutasFormateadas = rutas.map(r => ({
      fecha: r._id,
      numTiendas: r.count
    }))
    
    res.json({ success: true, rutas: rutasFormateadas })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al obtener rutas" })
  }
})

// Reporte por día
app.get("/api/registros/reporte-dia", auth, async (req, res) => {
  try {
    const { fecha } = req.query
    const registros = await Registro.find({
      fecha: { $gte: new Date(fecha), $lt: new Date(new Date(fecha).getTime() + 24*60*60*1000) }
    })
    
    // Debug logs removed for cleaner console output
    
    if (registros.length === 0) {
      return res.json({ success: true, reporte: null })
    }

    const PRECIOS = { kilos: 18, frijoles: 14, salsas: 13, totopos: 18, cambios: 0 }
    
    const reporte = {
      fecha,
      totalKilos: 0,
      totalFrijoles: 0,
      totalSalsas: 0,
      totalTotopos: 0,
      totalCambios: 0,
      importeKilos: 0,
      importeFrijoles: 0,
      importeSalsas: 0,
      importeTotopos: 0,
      importeCambios: 0,
      numTiendas: registros.length
    }

    registros.forEach(r => {
      // Only include tiendas that have actual data (any field > 0)
      const hasData = (r.kilos || 0) > 0 || (r.frijoles || 0) > 0 || (r.salsas || 0) > 0 || (r.totopos || 0) > 0 || (r.cambios || 0) > 0
      
      if (hasData) {
        // Special handling for GORDITAS - exclude kilos AND frijoles from totals (per user request)
        if (r.tienda === 'GORDITAS') {
          // For GORDITAS: exclude both kilos AND frijoles from product totals
          reporte.totalSalsas += r.salsas || 0
          reporte.totalTotopos += r.totopos || 0
          reporte.totalCambios += r.cambios || 0
          // NOTE: GORDITAS kilos AND frijoles are NOT added to totals
        } else {
          // Standard totals for other tiendas
          reporte.totalKilos += r.kilos || 0
          reporte.totalFrijoles += r.frijoles || 0
          reporte.totalSalsas += r.salsas || 0
          reporte.totalTotopos += r.totopos || 0
          reporte.totalCambios += r.cambios || 0
        }
        
        // Special handling for GORDITAS imports
        if (r.tienda === 'GORDITAS' && r.observaciones && r.observaciones.includes('GORDITAS_CALC:')) {
          try {
            const calcData = JSON.parse(r.observaciones.replace('GORDITAS_CALC:', ''))
            // Use the total amount from GORDITAS calculation, distributed correctly
            reporte.importeKilos += (calcData.kilosMasa || 0) * (calcData.precioMasa || 0)
            reporte.importeFrijoles += calcData.frijolesPesos || 0
          } catch (e) {
            // Fallback to standard calculation
            reporte.importeKilos += (r.kilos || 0) * PRECIOS.kilos
            reporte.importeFrijoles += (r.frijoles || 0) * PRECIOS.frijoles
          }
        } else {
          // Standard imports calculation for other tiendas
          reporte.importeKilos += (r.kilos || 0) * PRECIOS.kilos
          reporte.importeFrijoles += (r.frijoles || 0) * PRECIOS.frijoles
        }
        
        reporte.importeSalsas += (r.salsas || 0) * PRECIOS.salsas
        reporte.importeTotopos += (r.totopos || 0) * PRECIOS.totopos
        reporte.importeCambios -= (r.cambios || 0) * PRECIOS.kilos
      }
    })

    reporte.totalGeneral = reporte.totalKilos + reporte.totalFrijoles + reporte.totalSalsas + reporte.totalTotopos + reporte.totalCambios
    reporte.importeTotal = reporte.importeKilos + reporte.importeFrijoles + reporte.importeSalsas + reporte.importeTotopos + reporte.importeCambios

    res.json({ success: true, reporte })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error generando reporte" })
  }
})


// Tiendas CRUD endpoints
// Get all tiendas
app.get("/api/tiendas", auth, async (req, res) => {
  try {
    const tiendas = await Tienda.find().sort({ orden: 1, nombre: 1 })
    res.json({ success: true, tiendas })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error obteniendo tiendas" })
  }
})

// Create new tienda
app.post("/api/tiendas", auth, async (req, res) => {
  try {
    const { nombre } = req.body
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ success: false, message: "Nombre de tienda requerido" })
    }
    
    const tiendaExiste = await Tienda.findOne({ nombre: nombre.trim().toUpperCase() })
    if (tiendaExiste) {
      return res.status(400).json({ success: false, message: "Ya existe una tienda con ese nombre" })
    }
    
    const nuevaTienda = await Tienda.create({ 
      nombre: nombre.trim().toUpperCase(),
      activa: true 
    })
    res.json({ success: true, tienda: nuevaTienda, message: "Tienda creada exitosamente" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creando tienda" })
  }
})

// Update tienda
app.put("/api/tiendas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, activa } = req.body
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ success: false, message: "Nombre de tienda requerido" })
    }
    
    // Check if another tienda has the same name
    const tiendaExiste = await Tienda.findOne({ 
      nombre: nombre.trim().toUpperCase(),
      _id: { $ne: id }
    })
    if (tiendaExiste) {
      return res.status(400).json({ success: false, message: "Ya existe una tienda con ese nombre" })
    }
    
    const tiendaActualizada = await Tienda.findByIdAndUpdate(
      id,
      { 
        nombre: nombre.trim().toUpperCase(),
        activa: activa !== undefined ? activa : true
      },
      { new: true }
    )
    
    if (!tiendaActualizada) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" })
    }
    
    res.json({ success: true, tienda: tiendaActualizada, message: "Tienda actualizada exitosamente" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error actualizando tienda" })
  }
})

// Delete tienda (soft delete - mark as inactive)
app.delete("/api/tiendas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    
    // Mark as inactive instead of deleting to preserve existing registros
    const tienda = await Tienda.findByIdAndUpdate(
      id,
      { activa: false },
      { new: true }
    )
    
    if (!tienda) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" })
    }
    
    res.json({ success: true, message: "Tienda desactivada exitosamente. Los registros existentes se mantienen." })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error eliminando tienda" })
  }
})

// Get active tiendas only (for main interface)
app.get("/api/tiendas/activas", auth, async (req, res) => {
  try {
    const tiendas = await Tienda.find({ activa: true }).sort({ orden: 1, nombre: 1 })
    res.json({ success: true, tiendas })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error obteniendo tiendas activas" })
  }
})

// Get tiendas for a specific date (includes historical tiendas that had registros)
app.get("/api/tiendas/para-fecha", auth, async (req, res) => {
  try {
    const { fecha } = req.query
    if (!fecha) {
      return res.status(400).json({ success: false, message: "Fecha requerida" })
    }

    // Get all tiendas that had registros on this date
    const registrosDelDia = await Registro.find({
      fecha: { $gte: new Date(fecha), $lt: new Date(new Date(fecha).getTime() + 24*60*60*1000) }
    }).distinct('tienda')

    // Get all currently active tiendas with their order
    const tiendasActivas = await Tienda.find({ activa: true }).sort({ orden: 1, nombre: 1 })
    const nombresTiendasActivas = tiendasActivas.map(t => t.nombre)

    // Get tiendas that had registros but might not be active anymore
    const tiendasHistoricas = await Tienda.find({ nombre: { $in: registrosDelDia } }).sort({ orden: 1, nombre: 1 })
    const nombresHistoricos = tiendasHistoricas.map(t => t.nombre)

    // Combine and maintain order: first by orden field, then alphabetically for any without orden
    const todasLasTiendas = await Tienda.find({ 
      nombre: { $in: [...new Set([...nombresTiendasActivas, ...registrosDelDia])] }
    }).sort({ orden: 1, nombre: 1 })
    
    const tiendasParaFecha = todasLasTiendas.map(t => t.nombre)

    res.json({ success: true, tiendas: tiendasParaFecha })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error obteniendo tiendas para fecha" })
  }
})

// ==================== NOTAS ENDPOINTS ====================

// Get all notas
app.get("/api/notas", auth, async (req, res) => {
  try {
    const notas = await Nota.find().sort({ createdAt: -1 })
    res.json({ success: true, notas })
  } catch (error) {
    console.error('Error getting notas:', error)
    res.status(500).json({ success: false, message: "Error obteniendo notas" })
  }
})

// Get notas by date range
app.get("/api/notas/rango", auth, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query
    
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: "fechaInicio y fechaFin son requeridos" })
    }
    
    // Crear fechas con manejo mejorado de zona horaria
    const inicio = new Date(fechaInicio + 'T00:00:00.000Z')
    const fin = new Date(fechaFin + 'T23:59:59.999Z')
    
    const notas = await Nota.find({
      fecha: {
        $gte: inicio,
        $lte: fin
      }
    }).sort({ fecha: -1 })
    
    res.json({ success: true, notas })
  } catch (error) {
    console.error('Error getting notas by range:', error)
    res.status(500).json({ success: false, message: "Error obteniendo notas por rango" })
  }
})

// Create nota
app.post("/api/notas", auth, async (req, res) => {
  try {
    const { titulo, contenido, fecha } = req.body
    const user = req.user
    
    if (!titulo || !contenido) {
      return res.status(400).json({ success: false, message: "Título y contenido son requeridos" })
    }
    
    const nuevaNota = await Nota.create({
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      fecha: fecha ? new Date(fecha) : new Date(),
      creadoPor: user.id,
      nombreUsuario: user.nombre
    })
    
    res.json({ success: true, nota: nuevaNota, message: "Nota creada exitosamente" })
  } catch (error) {
    console.error('Error creating nota:', error)
    res.status(500).json({ success: false, message: "Error creando nota" })
  }
})

// Update nota
app.put("/api/notas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const { titulo, contenido, fecha } = req.body
    
    if (!titulo || !contenido) {
      return res.status(400).json({ success: false, message: "Título y contenido son requeridos" })
    }
    
    const notaActualizada = await Nota.findByIdAndUpdate(
      id,
      {
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        fecha: fecha ? new Date(fecha) : undefined
      },
      { new: true }
    )
    
    if (!notaActualizada) {
      return res.status(404).json({ success: false, message: "Nota no encontrada" })
    }
    
    res.json({ success: true, nota: notaActualizada, message: "Nota actualizada exitosamente" })
  } catch (error) {
    console.error('Error updating nota:', error)
    res.status(500).json({ success: false, message: "Error actualizando nota" })
  }
})

// Delete nota
app.delete("/api/notas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    
    const notaEliminada = await Nota.findByIdAndDelete(id)
    
    if (!notaEliminada) {
      return res.status(404).json({ success: false, message: "Nota no encontrada" })
    }
    
    res.json({ success: true, message: "Nota eliminada exitosamente" })
  } catch (error) {
    console.error('Error deleting nota:', error)
    res.status(500).json({ success: false, message: "Error eliminando nota" })
  }
})

// Start server
const PORT = 5001
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`)
  console.log(`✓ Frontend: http://localhost:3000`)
  console.log(`✓ Backend: http://localhost:${PORT}/api`)
})
