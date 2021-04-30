import { Telegram } from "telegraf"
import { MyUser, TelegramSendFunc } from "./typings"
import { fuzzySearch } from "./utils"

export default class Admin {
    id: number
    recipients: MyUser[] = []
    telegram: Telegram

    constructor(id: number, telegram: Telegram) {
        this.id = id
        this.telegram = telegram
    }

    async sendMessageToAdmin(text: string) {
        await this.sendMessageWithMarkdown(this.id, text)
    }

    async sendFileToAdmin(fileId: string, sendFunc: TelegramSendFunc) {
        await sendFunc(this.id, fileId)
    }

    async sendMessageToRecipients(text: string) {
        await Promise.allSettled(
            this.recipients.map((recipient) =>
                this.sendMessageWithMarkdown(recipient.id, text)
            )
        )
    }

    async sendFileToRecipients(fileId: string, sendFunc: TelegramSendFunc) {
        await Promise.allSettled(
            this.recipients.map((recipient) => sendFunc(recipient.id, fileId))
        )
    }

    async setRecipientsByNames(names: string[], users: MyUser[]) {
        const userNames = users.map((user) => user.name)
        const results = await Promise.all(
            names.map((name) => fuzzySearch(name, userNames))
        )
        const foundUsers = results
            .filter((result) => !!result)
            .map((name) => users.find((user) => user.name === name)!)
        this.setRecipients(foundUsers)
    }

    setRecipients(users: MyUser[]) {
        this.recipients = users
    }

    private async sendMessageWithMarkdown(id: number, text: string) {
        await this.telegram.sendMessage(id, text, { parse_mode: "Markdown" })
    }
}
