
const http = require('http');

http.get('http://localhost:3000/api/debug-data', (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("--- USERS ---");
            json.users.forEach(u => console.log(`${u.email} : ${u.tenantKey}`));
            console.log("--- STAFF ---");
            const staffByTenant = {};
            json.staff.forEach(s => {
                if (!staffByTenant[s.tenantKey]) staffByTenant[s.tenantKey] = 0;
                staffByTenant[s.tenantKey]++;
            });
            Object.keys(staffByTenant).forEach(k => console.log(`${k} : ${staffByTenant[k]} staff`));
        } catch (e) {
            console.log("Error parsing JSON");
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
