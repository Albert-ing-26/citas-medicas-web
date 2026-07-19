const mysql = require('mysql2/promise');

async function test() {
  try {
    const connDb = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'citas_medicas_db'
    });
    console.log('¡Conectado a citas_medicas_db!');
    
    const [usuarios] = await connDb.query('SELECT id_usuario, nombre, apellidos, correo, rol, activo FROM usuarios');
    console.log('Usuarios en la base de datos:');
    console.table(usuarios);
    
    await connDb.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
