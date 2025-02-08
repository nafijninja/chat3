require('dotenv').config();
const express = require('express');
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const DATA_FILE = "NAFIJ.json";
const UPLOAD_FOLDER = path.join(__dirname, "NAFIJ");

// Ensure the upload folder exists
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER);
}


// Ensure you are serving static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at the root URL (http://localhost:3000)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files from the NAFIJ directory
app.use('/NAFIJ', express.static(path.join(__dirname, 'NAFIJ')));



// Initialize data storage
function loadData() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return { messages: [], reactions: [], files: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

let chatData = loadData();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(UPLOAD_FOLDER));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Socket.io events
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("set username", (username) => {
    socket.username = username || "Anonymous";
  });

  socket.on("chat message", (msg) => {
    const messageData = {
      user: socket.username,
      text: msg.text,
      timestamp: Date.now()  // Timestamp Add
    };
    chatData.messages.push(messageData);
    saveData(chatData);
    io.emit("chat message", messageData);
  });

  socket.on("chat reaction", (reaction) => {
    const reactionData = {
      user: socket.username,
      reaction: reaction.reaction,
      timestamp: Date.now()  // Timestamp Add
    };
    chatData.reactions.push(reactionData);
    saveData(chatData);
    io.emit("chat reaction", reactionData);
  });


  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// API to fetch stored messages, reactions, and files
app.get("/loadMessages", (req, res) => {
  res.json(chatData);
});


app.get("/loadMessages", (req, res) => {
  let allItems = [
    ...chatData.messages.map(item => ({ ...item, type: "message", timestamp: item.timestamp || 0 })),
    ...chatData.files.map(item => ({ ...item, type: "file", timestamp: item.timestamp || 0 })),
    ...chatData.reactions.map(item => ({ ...item, type: "reaction", timestamp: item.timestamp || 0 }))
  ];

  // ✅ Timestamp na thakle 0 kore dilam & Sort kora holo timestamp onujayi
  allItems.sort((a, b) => a.timestamp - b.timestamp);

  res.json(allItems);
});




// File upload route
app.post("/upload", upload.single("file"), (req, res) => {
  const username = req.body.username || "Anonymous";  // Retrieve username from the request body

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileData = {
    user: username,  // Use the provided username
    fileUrl: `/NAFIJ/${req.file.filename}`,
    fileName: req.file.originalname,
    timestamp: Date.now()  // ✅ Add Timestamp to maintain correct order
  };

  chatData.files.push(fileData);
  saveData(chatData);

  io.emit("file message", fileData);  // Emit the file message to clients
  res.json(fileData);  // Respond with file data to the client
});


app.get('/test', (req, res) => {
  res.send('Server is running!');
});


// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
