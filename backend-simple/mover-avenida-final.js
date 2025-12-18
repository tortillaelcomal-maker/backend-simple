const mongoose = require('mongoose');

// Conectar a MongoDB Atlas
const MONGODB_URI = 'mongodb+srv://2236001057_db_user:aoJchBA3n43VTWEW@cluster0.zuxzkfl.mongodb.net/comal_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error de conexión:', err));

// Definir schema de Tienda
const tiendaSchema = new mongoose.Schema({
  nombre: { type: String, unique: true },
  activa: { type: Boolean, default: true },
  orden: { type: Number, default: 999 }
});

const Tienda = mongoose.model("Tienda", tiendaSchema);

async function moverAvenidaAlFinal() {
  try {
    // Primero, obtener todas las tiendas activas ordenadas
    const tiendas = await Tienda.find({ activa: true }).sort({ orden: 1, nombre: 1 });
    
    console.log('\n📋 Tiendas actuales:');
    tiendas.forEach((t, i) => {
      console.log(`${i + 1}. ${t.nombre} (orden: ${t.orden})`);
    });
    
    // Asignar orden secuencial a todas las tiendas
    let ordenActual = 1;
    for (const tienda of tiendas) {
      if (tienda.nombre === 'AVENIDA') {
        // AVENIDA se procesará al final
        continue;
      }
      await Tienda.updateOne(
        { _id: tienda._id },
        { $set: { orden: ordenActual } }
      );
      ordenActual++;
    }
    
    // Ahora asignar el último orden a AVENIDA
    const avenida = await Tienda.findOne({ nombre: 'AVENIDA' });
    if (avenida) {
      await Tienda.updateOne(
        { _id: avenida._id },
        { $set: { orden: ordenActual } }
      );
      console.log(`\n✅ AVENIDA movida al final con orden: ${ordenActual}`);
    } else {
      console.log('\n⚠️ No se encontró la tienda AVENIDA');
    }
    
    // Mostrar resultado final
    const tiendasActualizadas = await Tienda.find({ activa: true }).sort({ orden: 1, nombre: 1 });
    console.log('\n📋 Orden final de tiendas:');
    tiendasActualizadas.forEach((t, i) => {
      console.log(`${i + 1}. ${t.nombre} (orden: ${t.orden})`);
    });
    
    console.log('\n✨ Proceso completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar
moverAvenidaAlFinal();
