
const WebSocket = require('ws');

const port = 1866;
const url = `ws://localhost:${port}/ws`;

console.log(`Testing connection to ${url}...`);

try {
    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log('✅ Connected successfully to Cheshire Cat!');
        ws.send(JSON.stringify({ text: "Ping from test script" }));

        // Close after 2 seconds if valid
        setTimeout(() => {
            console.log('Closing test connection.');
            ws.close();
        }, 2000);
    });

    ws.on('message', (data) => {
        console.log('📩 Received message:', data.toString());
    });

    ws.on('error', (err) => {
        console.error('❌ Connection error:', err.message);
    });

    ws.on('close', () => {
        console.log('Connection closed.');
    });

} catch (e) {
    console.error('Script error:', e);
}
