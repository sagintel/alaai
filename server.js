const PORT = 8000
const express = require('express')
const cors = require('cors')
const app = express()
app.use(cors())
app.use(express.json())
require('dotenv').config()

const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

app.post('/gemini', async (req, res) => {
    console.log(req.body.history)
    console.log(req.body.message)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    // Format the history correctly
    const formattedHistory = req.body.history.map(item => ({
        role: item.role,
        parts: [{ text: item.parts }]
    }));

    const chat = model.startChat({
        history: formattedHistory
    })
    const msg = req.body.message

    const result = await chat.sendMessage(msg)
    const response = await result.response
    const text = response.text()
    res.send(text)
})

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))