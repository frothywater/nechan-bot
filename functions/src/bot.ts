import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import { Telegraf } from "telegraf"
import { Message } from "typegram"
// ===================================================================
// Initialize.
// ===================================================================
import serviceAccount from "../key/serviceAccountKey.json"
import Admin from "./admin"
import Database from "./database"
import fileFuncRelations from "./fileTable"
import {
    MyContext,
    MySupportedFileType,
    MyUser,
    supportedFileTypes,
} from "./typings"
import * as utils from "./utils"

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
})

const database = new Database(admin.firestore())
const bot = new Telegraf(functions.config().bot.token)

const adminId: number[] = (functions.config().bot.admin as string)
    .split(",")
    .map((str) => parseInt(str))
const admins = adminId.map((id) => new Admin(id, bot.telegram))

// ===================================================================
// Global middlewares.
// ===================================================================

bot.start((ctx) => ctx.reply(utils.welcomeSentence))

bot.use(async (ctx, next) => {
    await next()
    if (ctx.message) await updateDatabaseFromMessage(ctx.message)
})

// If the update is from one of admin, add this to ctx.
bot.use(async (ctx: MyContext, next) => {
    if (ctx.chat?.type === "private")
        ctx.admin = admins.find((admin) => admin.id === ctx.from?.id)
    await next()
})

bot.catch((error: unknown) => {
    admins.forEach((admin) => admin.sendMessageToAdmin(utils.errorLog(error)))
})

// ===================================================================
// Admin commands.
// ===================================================================

bot.command("list", async (ctx: MyContext) => {
    await ctx.admin?.sendMessageToAdmin(
        utils.usersLog(await database.getUsers())
    )
})

bot.command("now", async (ctx: MyContext) => {
    await ctx.admin?.sendMessageToAdmin(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

bot.command("use", async (ctx: MyContext) => {
    const names = utils.namesInCommand(
        (ctx.message as Message.TextMessage).text
    )
    const userNames = await database.getUsers()
    await ctx.admin?.setRecipientsByNames(names, userNames)
    await ctx.admin?.sendMessageToAdmin(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

bot.command("all", async (ctx: MyContext) => {
    ctx.admin?.setRecipients(await database.getUsers())
    await ctx.admin?.sendMessageToAdmin(
        utils.currentRecipientsLog(ctx.admin.recipients)
    )
})

// ===================================================================

bot.on("text", handleText)

// Register listener for each supported file type
supportedFileTypes.forEach((type) =>
    bot.on(type, (ctx) => handleFile(ctx, type))
)

// ===================================================================

async function handleText(ctx: MyContext) {
    if (ctx.admin) {
        const text = (ctx.message as Message.TextMessage).text
        await ctx.admin.sendMessageToRecipients(text)
        await ctx.admin.sendMessageToAdmin(
            utils.sentTextLog(ctx.admin.recipients, text)
        )
    } else if (ctx.chat?.type === "private")
        await Promise.allSettled(
            admins.map((admin) =>
                admin.sendMessageToAdmin(
                    utils.userComingTextLog(ctx.message as Message.TextMessage)
                )
            )
        )
}

async function handleFile(ctx: MyContext, type: MySupportedFileType) {
    const { sendFunc, getFileIDFunc } = fileFuncRelations(ctx.telegram)[type]
    const fileID = getFileIDFunc(ctx)

    if (ctx.admin) {
        await ctx.admin.sendFileToRecipients(fileID, sendFunc)
        await ctx.admin.sendMessageToAdmin(
            utils.sentFileLog(ctx.admin.recipients)
        )
    } else if (ctx.chat?.type === "private")
        await Promise.allSettled(
            admins.map((admin) => {
                admin.sendMessageToAdmin(
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    utils.userComingFileLog(ctx.message!, type)
                )
                admin.sendFileToAdmin(fileID, sendFunc)
            })
        )
}

async function updateDatabaseFromMessage(message: Message) {
    const { from: fromUser, chat } = message
    const name = await database.getNameById(chat.id)
    if (!name) {
        let user: MyUser
        if (chat.type === "private")
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            user = { id: fromUser!.id, name: utils.fullName(fromUser!) }
        else user = { id: chat.id, name: chat.title }
        await database.addUser(user)
    }
}

// ===================================================================

export default bot
