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

    async sendMessageToAdmin(text: string): Promise<void> {
        await this.sendMessageWithMarkdown(this.id, text)
    }

    async sendFileToAdmin(
        fileId: string,
        sendFunc: TelegramSendFunc
    ): Promise<void> {
        await sendFunc(this.id, fileId)
    }

    async sendMessageToRecipients(text: string): Promise<void> {
        await Promise.allSettled(
            this.recipients.map((recipient) =>
                this.sendMessageWithMarkdown(recipient.id, text)
            )
        )
    }

    async sendFileToRecipients(
        fileId: string,
        sendFunc: TelegramSendFunc
    ): Promise<void> {
        await Promise.allSettled(
            this.recipients.map((recipient) => sendFunc(recipient.id, fileId))
        )
    }

    async setRecipientsByNames(
        names: string[],
        users: MyUser[]
    ): Promise<void> {
        const userNames = users.map((user) => user.name)
        const results = await Promise.all(
            names.map((name) => fuzzySearch(name, userNames))
        )
        const foundUsers = results
            .filter((result) => !!result)
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .map((name) => users.find((user) => user.name === name)!)
        this.setRecipients(foundUsers)
    }

    setRecipients(users: MyUser[]): void {
        this.recipients = users
    }

    private async sendMessageWithMarkdown(id: number, text: string) {
        await this.telegram.sendMessage(id, text, { parse_mode: "Markdown" })
    }
}
