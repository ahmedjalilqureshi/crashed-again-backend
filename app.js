// Import required modules
const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');

// Initialize Express app
const app = express();
const PORT = 80;

// Middleware to parse JSON request bodies
app.use(express.json());

// Route to check website status
app.get('/status', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required.' });
    }

    try {
        // Make a HEAD request to check the website status
        const response = await axios.head(url);

        // Return the status code and status text
        res.json({
            url,
            status: response.status,
            statusText: response.statusText
        });
    } catch (error) {
        console.error('Error checking website status:', error);

        // Handle errors and provide appropriate status information
        if (error.response) {
            res.json({
                url,
                status: error.response.status,
                statusText: error.response.statusText
            });
        } else {
            res.status(500).json({ error: 'Failed to check website status. The website might be down or unreachable.' });
        }
    }
});

// Route to capture a snapshot of a website
app.get('/snapshot', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required.' });
    }

    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto("https://"+url, { waitUntil: 'networkidle2' });

        // Capture a screenshot
        const screenshot = await page.screenshot({ encoding: 'base64' });
        await browser.close();

        // Return the screenshot as base64
        res.send(`<html><body><img src="data:image/png;base64,${screenshot}"></body></html>`);
    } catch (error) {
        console.error('Error capturing website snapshot:', error);
        res.status(500).json({ error: 'Failed to capture website snapshot.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
