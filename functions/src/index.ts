import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import * as allSettled from "promise.allsettled"
import Telegraf, { Telegram } from "telegraf"
import { Message } from "telegraf/typings/telegram-types"
import Admin from "./admin"
import Database from "./database"
import fileTable from "./fileTable"
import { MyContext, MyUser } from "./typings"
import * as utils from "./utils"

// Initialize.
const serviceAccount = require("../key/serviceAccountKey.json")
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://nechan-bot.firebaseio.com",
})

const database = new Database(admin.firestore())
const bot = new Telegraf(functions.config().bot.token)
const telegram = new Telegram(functions.config().bot.token)

const adminId: number[] = (functions.config().bot.admin as string)
    .split(",")
    .map((str) => parseInt(str))
const admins = adminId.map((id) => new Admin(id, telegram))

// ===================================================================
// Global middlewares.
// ===================================================================

bot.start((ctx) => ctx.reply(utils.welcomeSentence))

bot.use(async (ctx, next) => {
    await next!()
    if (ctx.message) await updateDatabaseFromMessage(ctx.message)
})

// If the update is from one of admin, add this to ctx.
bot.use(async (ctx: MyContext, next) => {
    if (ctx.chat!.id > 0)
        ctx.admin = admins.find((admin) => admin.id === ctx.from!.id)
    await next!()
})

bot.catch((error: any) => {
    admins.forEach((admin) => admin.sendMessage(utils.errorLog(error)))
})

// ===================================================================
// Admin commands.
// ===================================================================

bot.command("list", async (ctx: MyContext) => {
    await ctx.admin?.sendMessage(utils.usersLog(await database.getUsers()))
})

bot.command("now", async (ctx: MyContext) => {
    await ctx.admin?.sendMessage(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

bot.command("use", async (ctx: MyContext) => {
    const names = utils.namesInCommand(ctx.message!.text!)
    const userNames = await database.getUsers()
    await ctx.admin?.setRecipientsByNames(names, userNames)
    await ctx.admin?.sendMessage(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

bot.command("all", async (ctx: MyContext) => {
    ctx.admin?.setRecipients(await database.getUsers())
    await ctx.admin?.sendMessage(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

// ===================================================================

bot.on("text", handleText)

bot.on(utils.supportedFileTypes, handleFile)

exports.bot = functions.https.onRequest(async (req, res) => {
    await bot.handleUpdate(req.body, res)
    res.end()
})

async function handleText(ctx: MyContext, next: any) {
    if (ctx.admin) {
        const text = ctx.message!.text!
        await ctx.admin.sendMessageToRecipients(text)
        await ctx.admin.sendMessage(
            utils.sentTextLog(ctx.admin.recipients, text)
        )
    } else if (ctx.chat!.id > 0)
        await allSettled(
            admins.map((admin) =>
                admin.sendMessage(utils.userComingTextLog(ctx.message!))
            )
        )
}

async function handleFile(ctx: MyContext) {
    const fileType = utils.supportedFileTypes.find((supportedType) =>
        ctx.updateSubTypes.find((type) => type === supportedType)
    )
    if (!fileType) return
    const { sendFunc, fileId } = fileTable(telegram)[fileType]

    if (ctx.admin) {
        await ctx.admin.sendFileToRecipients(fileId(ctx)!, sendFunc)
        await ctx.admin.sendMessage(utils.sentFileLog(ctx.admin.recipients))
    } else if (ctx.chat!.id > 0)
        await allSettled(
            admins.map((admin) => {
                admin.sendMessage(
                    utils.userComingFileLog(ctx.message!, fileType)
                )
                admin.sendFile(fileId(ctx)!, sendFunc)
            })
        )
}

async function updateDatabaseFromMessage(message: Message) {
    const { from, chat } = message
    const name = await database.getNameById(chat.id)
    if (!name) {
        let user: MyUser
        if (chat.id > 0)
            user = {
                id: from!.id,
                name: utils.fullName(from!),
            }
        else
            user = {
                id: chat.id,
                name: chat.title!,
            }
        await database.addUser(user)
    }
}
