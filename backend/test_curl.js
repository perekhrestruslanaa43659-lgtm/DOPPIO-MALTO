const { exec } = require('child_process');
exec('curl -v "http://localhost:4000/api/schedule?start=2025-10-13&end=2025-10-19"', (err, stdout, stderr) => {
    console.log("Stdout:", stdout);
    console.log("Stderr:", stderr);
});
