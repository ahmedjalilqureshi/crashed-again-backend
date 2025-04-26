// Import required modules
const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require("path");
const cors = require("cors");
const connectDB = require("./init/connectDB");
connectDB();
const Domain = require("./models/Domain");
// Initialize Express app
const app = express();
const PORT = process.env.PORT;
app.use(cors());

// Middleware to parse JSON request bodies
app.use(express.json());
app.use("/cdn", express.static(path.join(__dirname, "cdn")));
app.get("/website-info", async (req, res) => {
    const { url,userId } = req.query;
  
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required." });
    }
  
    try {
      // Check if the domain already exists in the database
      const existingDomain = await Domain.findOne({ url });
  
      const now = new Date();
  
      let snapshotPath;
      if (existingDomain) {
        // Check if the snapshot is older than 5 minutes
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
        if (existingDomain.lastUpdate < fiveMinutesAgo) {
          // Capture a new snapshot
          const {snapshotPath:snap,matric} = await captureSnapshot(url);
          console.log("=========",matric);
          snapshotPath = snap;
          existingDomain.snapshot = snapshotPath;
          existingDomain.lastUpdate = now;
        } else {
          snapshotPath = existingDomain.snapshot; // Use existing snapshot
        }
      } else {
        // Capture a new snapshot for the first time
        const {snapshotPath:snap,matric} = await captureSnapshot(url);
        console.log("=========",matric);
        snapshotPath = snap;
  
        // Create a new domain entry
        await Domain.create({
          url,
          status: "unknown", // Will be updated later
          ping: 0, // Will be updated later
          responseRate: "unknown", // Will be updated later
          snapshot: snapshotPath,
          lastUpdate: now,
        });
      }
  
      // Check the website status
      let response,responseTime;
      try{
        const startTime = Date.now();
        response = await axios.head(url);
        responseTime = Date.now() - startTime;
      }
      catch(err)
      {
        console.log("resp",err,response);
      }

      // Update the domain details
      const domain = await Domain.findOneAndUpdate(
        { url },
        {
          status: response?.statusText || "unknown",
          ping: response?.status || 0,
          responseRate: response?.headers?.["request-duration"] || responseTime,
          lastUpdate: now,
        },{returnDocument:'after'}
      );
      if(domain.responseRate == "unknown"){
        send_notification(userId,"Oops! Website is down","One of your website is down '"+url+"'")
      }
      res.json({
        url,
        data:domain,
      });
    } catch (error) {
      console.error("Error processing website information:", error);
      send_notification(userId,"Oops! Website is down","One of your website is down '"+url+"'")
      if (error.response) {
        res.status(error.response.status).json({
          url,
          status: error.response.status,
          statusText: error.response.statusText,
        });
      } else {
        res.status(500).json({ error: "Failed to process website information." });
      }
    }
  });
  
  // Function to capture a snapshot
  async function captureSnapshot(url) {
    try {
    const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    
    const page = await browser.newPage();
        // Inject Web Vitals library using Puppeteer's page.addScriptTag
      // Inject Web Vitals library using addScriptTag
      await page.goto(`${url}`, { waitUntil: "networkidle2" });
    // Capture the snapshot
      const snapshotPath = `${url.replace(/[:/]/g, "_")}.png`;
      await page.screenshot({
        path: path.join(__dirname, "cdn", snapshotPath),
      });
    
     
      // Close the browser
      await browser.close();
    
      return {
        snapshotPath,
      };
    } catch (error) {
        return {
            snapshotPath:null,
        };
    }
}
// Route to check website status
app.get('/status', async (req, res) => {
    const { url,userId } = req.query;

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
        const browser = await puppeteer.launch(
            {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            }
        );
        const page = await browser.newPage();
        await page.goto("https://"+url, { waitUntil: 'networkidle2' });

         // Capture a screenshot
         const screenshotPath = path.join(__dirname, 'cdn', `${url.replace(/[:/]/g, '_')}.png`);
         await page.screenshot({ path: screenshotPath });
         await browser.close();

        // Return the screenshot as base64
        // res.send(`<html><body><img src="data:image/png;base64,${screenshot}"></body></html>`);
    } catch (error) {
        console.error('Error capturing website snapshot:', error);
        res.status(500).json({ error: 'Failed to capture website snapshot.' });
    }
});

const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID ;
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const send_notification = async(externalUserId,heading,message) =>{
  // const { externalUserId, message, heading } = req.body;
  if (!externalUserId || !message) {
    return false
  }

  try {
    // OneSignal API request payload
    const payload = {
      app_id: ONE_SIGNAL_APP_ID,
      include_external_user_ids: [externalUserId],
      headings: { en: heading || 'Notification' },
      contents: { en: message },
    };

    // Send POST request to OneSignal API
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
        },
      }
    );

    return true
  } catch (error) {
    console.error('Error sending notification:', error);
    return false
  }

}
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
