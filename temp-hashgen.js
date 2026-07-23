const bcrypt = require('bcrypt');
const passwords = {
  admin: 'Admin1234!',
  medico: 'Medico1234!',
  paciente: 'Paciente1234!'
};
for (const [role, pwd] of Object.entries(passwords)) {
  const hash = bcrypt.hashSync(pwd, 10);
  console.log(`${role}: ${hash}`);
}
