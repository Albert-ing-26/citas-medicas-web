const mysql = require('mysql2/promise');

async function test() {
  try {
    const connDb = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'citasmedicas_db'
    });
    console.log('¡Conectado a citasmedicas_db!');

    const [administradores] = await connDb.query('SELECT id_admin, nombre, apellidos, correo, estado FROM administradores');
    console.log('Administradores en la base de datos:');
    console.table(administradores);

    const [medicos] = await connDb.query('SELECT id_medico, nombre, apellidos, correo, colegiatura, estado FROM medicos');
    console.log('Medicos en la base de datos:');
    console.table(medicos);

    const [pacientes] = await connDb.query('SELECT id_paciente, nombre, apellidos, correo, dni, estado FROM pacientes');
    console.log('Pacientes en la base de datos:');
    console.table(pacientes);

    await connDb.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
