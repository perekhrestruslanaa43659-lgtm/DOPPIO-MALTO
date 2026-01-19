
const fetch = require('node-fetch');

async function go() {
    try {
        const res = await fetch('http://localhost:3000/api/staff');
        const staff = await res.json();
        const seck = staff.find(s => s.nome.toLowerCase().includes('seck') || (s.cognome && s.cognome.toLowerCase().includes('seck')));

        if (seck) {
            console.log(`FOUND: ID=${seck.id} Name=${seck.nome} ${seck.cognome}`);
            console.log(`Current Postazioni: ${JSON.stringify(seck.postazioni)}`);
            console.log(`Current FixedShifts: ${JSON.stringify(seck.fixedShifts)}`);
        } else {
            console.log("Seck Codou not found.");
        }
    } catch (e) {
        console.error(e);
    }
}
go();
