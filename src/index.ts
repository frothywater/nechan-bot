import { Telegram } from "telegraf";
import Telegraf from "telegraf";
import low from "lowdb";
import SocksProxyAgent = require("socks-proxy-agent");
import FileAsync from "lowdb/adapters/FileAsync";
import FileSync from "lowdb/adapters/FileSync";
import { CollectionChain } from "lodash";
import fuzz from "fuzzball";
import * as _ from "lodash";
import { InputFile } from "telegraf/typings/telegram-types";

require("dotenv").config({ path: "config/.env" });
const {
    BOT_TOKEN,
    SOCKS_PROXY,
    ADMIN_CHAT_ID,
    DATABASE_PATH,
    WEBHOOK_URL,
    WEBHOOK_PATH,
    WEBHOOK_PORT
} = process.env;
const ADMINS_ID: number[] = ADMIN_CHAT_ID.replace(" ", "")
    .split(",")
    .map(id => parseInt(id));

const adapter = new FileAsync(DATABASE_PATH);
let db: low.LowdbAsync<any>;
let dbSync = low(new FileSync(DATABASE_PATH));

let admins: {
    [id: number]: {
        name: string;
        recipients: Recipient[];
    };
} = {};

for (let adminId of ADMINS_ID) {
    const name = (dbSync.get("users") as CollectionChain<any>)
        .find(user => user.id === adminId)
        .value().name;
    admins[adminId] = {
        name: name,
        recipients: []
    };
}

let bot = new Telegraf(BOT_TOKEN);
let telegram = new Telegram(BOT_TOKEN);
if (SOCKS_PROXY) {
    const agent = new SocksProxyAgent(SOCKS_PROXY);
    bot = new Telegraf(BOT_TOKEN, { telegram: { agent: agent } });
    telegram = new Telegram(BOT_TOKEN, { agent: agent });
}

interface Recipient {
    id: number;
    name: string;
}

interface SendFunction {
    (chatId: number | string, file: InputFile, extra?: any): Promise<any>;
}

bot.telegram.setWebhook(WEBHOOK_URL);
bot.startWebhook(WEBHOOK_PATH, null, parseInt(WEBHOOK_PORT));

bot.start(ctx => ctx.reply("我喜欢可爱的小弟弟。"));
bot.use(async (ctx, next) => {
    if (!db) db = await low(adapter);
    if (ctx.message) await updateDatabase(ctx.message);

    if (
        !(ctx.from.id in admins) &&
        ctx.chat.id > 0 &&
        !ctx.updateSubTypes.includes("text")
    ) {
        await sendMessageToAdmins(getFullNameWithGroup(ctx.message));
    }

    await next();
});

// List all users and groups.
bot.hears("/list", async ctx => {
    if (!(ctx.chat.id in admins)) return;
    const usersStr =
        "*Users:*\n" +
        (db.get("users") as CollectionChain<any>)
            .map("name")
            .value()
            .join(", ");
    const groupsStr =
        "*Groups:*\n" +
        (db.get("groups") as CollectionChain<any>)
            .map("name")
            .value()
            .join(", ");
    await sendMessageToAdmins(`${usersStr}\n${groupsStr}`);
});

// Show current recipients.
bot.hears("/now", async ctx => {
    if (!(ctx.chat.id in admins)) return;
    await sendCurrentRecipientsToAdmin(ctx.chat.id);
});

function getNamesInCommand(str: string) {
    return str
        .slice(str.indexOf(" "))
        .trim()
        .split(" ");
}

bot.hears(
    (str: string) => str.startsWith("/use"),
    async ctx => {
        if (!(ctx.chat.id in admins)) return;
        const adminId = ctx.chat.id;
        const names = getNamesInCommand(ctx.message.text);
        admins[adminId].recipients = [];
        for (const name of names) await addRecipient(adminId, name);
        await sendCurrentRecipientsToAdmin(adminId);
    }
);

bot.hears(
    (str: string) => str.startsWith("/add"),
    async ctx => {
        if (!(ctx.chat.id in admins)) return;
        const adminId = ctx.chat.id;
        const names = getNamesInCommand(ctx.message.text);
        for (const name of names) await addRecipient(adminId, name);
        await sendCurrentRecipientsToAdmin(adminId);
    }
);

bot.hears(
    (str: string) => str.startsWith("/remove"),
    async ctx => {
        if (!(ctx.chat.id in admins)) return;
        const adminId = ctx.chat.id;
        const names = getNamesInCommand(ctx.message.text);
        for (const name of names) await removeRecipient(adminId, name);
        await sendCurrentRecipientsToAdmin(adminId);
    }
);

bot.hears("/reset", async ctx => {
    if (!(ctx.chat.id in admins)) return;
    const adminId = ctx.chat.id;
    admins[adminId].recipients = [];
    await sendCurrentRecipientsToAdmin(adminId);
});

bot.hears("/alluser", async ctx => {
    if (!(ctx.chat.id in admins)) return;
    const adminId = ctx.chat.id;
    admins[adminId].recipients = (db.get("users") as CollectionChain<any>)
        .map(user => {
            const reci: Recipient = { id: user.id, name: user.name };
            return reci;
        })
        .value();
    await sendCurrentRecipientsToAdmin(adminId);
});

bot.hears(
    (str: string) => str.startsWith("/"),
    async (ctx, next) => {
        if (ctx.chat.id in admins) return;
        else await next();
    }
);

bot.on("text", async ctx => {
    const text = ctx.message.text;
    if (ctx.chat.id in admins) {
        await sendMessageToRecipients(ctx.chat.id, text);
    } else if (ctx.chat.id > 0)
        await sendMessageToAdmins(
            `${getFullNameWithGroup(ctx.message)}\n${text}`
        );
});

bot.on("sticker", async ctx => {
    const fileId = ctx.message.sticker.file_id;
    if (ctx.chat.id in admins)
        await sendFileToRecipients(ctx.chat.id, fileId, telegram.sendSticker);
    else if (ctx.chat.id > 0)
        await sendFileToAdmins(fileId, telegram.sendSticker);
});

bot.on("photo", async ctx => {
    const fileId = ctx.message.photo.pop().file_id;
    if (ctx.chat.id in admins)
        await sendFileToRecipients(ctx.chat.id, fileId, telegram.sendPhoto);
    else if (ctx.chat.id > 0)
        await sendFileToAdmins(fileId, telegram.sendPhoto);
});

bot.on("audio", async ctx => {
    const fileId = ctx.message.audio.file_id;
    if (ctx.chat.id in admins)
        await sendFileToRecipients(ctx.chat.id, fileId, telegram.sendAudio);
    else if (ctx.chat.id > 0)
        await sendFileToAdmins(fileId, telegram.sendAudio);
});

bot.catch(async err => {
    await sendMessageToAdmins(`⚠ _Error: ${err}_`);
});

bot.launch();

function findById(category: "users" | "groups", id: number): any {
    return (db.get(category) as CollectionChain<any>).find(["id", id]).value();
}

async function findByName(
    category: "users" | "groups",
    name: string
): Promise<any> {
    const choices: string[] = (db.get(category) as CollectionChain<any>)
        .map("name")
        .value();
    const result = await fuzz.extractAsPromised(name, choices, {
        scorer: fuzz.partial_token_sort_ratio,
        returnObjects: true
    });
    const maxItem = _.maxBy(result, item => item.score);
    if (maxItem.score < 80) return undefined;
    else
        return (db.get(category) as CollectionChain<any>)
            .find(["name", maxItem.choice])
            .value();
}

function findUserById(id: number): any {
    return findById("users", id);
}

function findGroupById(id: number): any {
    return findById("groups", id);
}

async function findUserByName(name: string): Promise<any> {
    return findByName("users", name);
}
async function findGroupByName(name: string): Promise<any> {
    return findByName("groups", name);
}

async function sendFileToRecipients(
    adminId: number,
    fileId: string,
    func: SendFunction
) {
    const recipients = admins[adminId].recipients;
    for (const reci of recipients) await func.bind(telegram, reci.id, fileId)();

    const reciStr = recipients.map(recipient => recipient.name).join(", ");
    await sendMessageToAdmins(
        `✅ *(${admins[adminId].name})* _sends to:_ *${reciStr}*`
    );
}

async function sendFileToAdmins(fileId: string, func: SendFunction) {
    for (let id in admins) await func.bind(telegram, id, fileId)();
}

async function sendMessageToRecipients(adminId: number, text: string) {
    const recipients = admins[adminId].recipients;
    for (const reci of recipients)
        await telegram.sendMessage(reci.id, text, {
            parse_mode: "Markdown"
        });

    const reciStr = recipients.map(recipient => recipient.name).join(", ");
    await sendMessageToAdmins(
        `${text}\n✅ *(${admins[adminId].name})* _sends to:_ *${reciStr}*`
    );
}

async function sendMessageToAdmin(adminId: number, text: string) {
    await telegram.sendMessage(adminId, text, { parse_mode: "Markdown" });
}

async function sendMessageToAdmins(text: string) {
    for (let id in admins)
        await telegram.sendMessage(id, text, { parse_mode: "Markdown" });
}

async function updateDatabase(message: any) {
    const { from, chat } = message;
    if (chat.id > 0 && !findUserById(chat.id)) {
        await (db.get("users") as CollectionChain<any>)
            .push({
                id: from.id,
                name: getFullName(from),
                userName: from.username
            })
            .write();
        await db.update("userCount", n => n + 1).write();
    }
    if (chat.id < 0 && !findGroupById(chat.id)) {
        await (db.get("groups") as CollectionChain<any>)
            .push({
                id: chat.id,
                name: chat.title
            })
            .write();
        await db.update("groupCount", n => n + 1).write();
    }
}

async function addRecipient(adminId: number, name: string) {
    const recipients = admins[adminId].recipients;
    const user = await findUserByName(name);
    const group = await findGroupByName(name);
    if (user) {
        if (!recipients.find(reci => reci.id === user.id))
            recipients.push({
                id: user.id,
                name: user.name
            });
    } else if (group) {
        if (!recipients.find(reci => reci.id === group.id))
            recipients.push({
                id: group.id,
                name: group.name
            });
    }
}

async function removeRecipient(adminId: number, name: string) {
    const recipients = admins[adminId].recipients;
    const user = await findUserByName(name);
    const group = await findGroupByName(name);
    if (user) {
        if (recipients.find(reci => reci.id === user.id))
            _.remove(recipients, reci => reci.name === user.name);
    } else if (group) {
        if (recipients.find(reci => reci.id === group.id))
            _.remove(recipients, reci => reci.name === group.name);
    }
}

async function sendCurrentRecipientsToAdmin(adminId: number) {
    const recipients = admins[adminId].recipients;
    const str = recipients.map(recipient => recipient.name).join(", ");
    await sendMessageToAdmin(
        adminId,
        `✅ _Current recipients of ${admins[adminId].name}:_\n *${str}*`
    );
}

function getFullName(from: any): string {
    let name = from.first_name;
    if (from.last_name) name += " " + from.last_name;
    return name;
}

function getFullNameWithGroup(message: any): string {
    const userSign = `*${message.from.first_name} ${
        message.from.last_name ? message.from.last_name : ""
    }*`;
    if (message.chat.id < 0) return userSign + ` from _${message.chat.title}_`;
    else return userSign;
}
