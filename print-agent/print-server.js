const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
// pdf-to-printer works on Windows. For Unix, one might use 'unix-print' or 'lp' command via exec.
// The user specified "Impresoras Locales HP LaserJet A4" and "Windows" context implicitly or explicitly in similar tasks.
// Using pdf-to-printer.
const ptp = require('pdf-to-printer');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Endpoint 1: GET /printers
app.get('/printers', async (req, res) => {
    try {
        const printers = await ptp.getPrinters();
        res.json({ success: true, printers });
    } catch (error) {
        console.error('Error getting printers:', error);
        res.status(500).json({ success: false, error: 'Failed to list printers' });
    }
});

// Endpoint 2: POST /print
app.post('/print', async (req, res) => {
    const { url, printer } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'Missing PDF URL' });
    }

    // Security: Validate Domain
    const allowedDomains = ['sistema-ventas-loa-backend-production.up.railway.app', 'api.sistemaloa.com'];
    try {
        const parsedUrl = new URL(url);
        if (!allowedDomains.includes(parsedUrl.hostname)) {
            console.warn(`Blocked request from unauthorized domain: ${parsedUrl.hostname}`);
            return res.status(403).json({ success: false, error: 'Domain not allowed' });
        }
    } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    console.log(`Received print request for: ${url} on printer: ${printer || 'Default'}`);

    const randomId = crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempFilePath = path.join(__dirname, `print_${randomId}.pdf`);

    const file = fs.createWriteStream(tempFilePath);

    // Determine protocol
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
            fs.unlink(tempFilePath, () => { }); // Clean up empty file
            return res.status(500).json({ success: false, error: `Failed to download PDF. Status Code: ${response.statusCode}` });
        }

        response.pipe(file);

        file.on('finish', () => {
            file.close(async () => {
                console.log(`PDF downloaded to: ${tempFilePath}`);

                try {
                    const options = printer ? { printer } : {};
                    await ptp.print(tempFilePath, options);
                    console.log('Print job sent successfully.');

                    // Respond success
                    res.json({ success: true, message: 'Print job sent successfully' });
                } catch (printError) {
                    console.error('Printing error:', printError);
                    res.status(500).json({ success: false, error: 'Failed to send to printer' });
                } finally {
                    // Cleanup temp file
                    fs.unlink(tempFilePath, (err) => {
                        if (err) console.error('Error deleting temp file:', err);
                        else console.log('Temp file deleted.');
                    });
                }
            });
        });
    }).on('error', (err) => {
        fs.unlink(tempFilePath, () => { });
        console.error('Download error:', err);
        res.status(500).json({ success: false, error: 'Error downloading PDF' });
    });
});

app.listen(PORT, () => {
    console.log(`Local Print Agent running on http://localhost:${PORT}`);
    console.log(`Allows CORS from all origins.`);
    console.log(`IMPORTANT: Ensure Port ${PORT} is open in Windows Firewall for LAN access.`);
});
