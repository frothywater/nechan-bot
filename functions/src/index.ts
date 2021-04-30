import * as functions from "firebase-functions"
import bot from "./bot"

// Testing auto deploy

exports.bot = functions.https.onRequest(async (req, res) => {
    await bot.handleUpdate(req.body, res)
    res.end()
})
