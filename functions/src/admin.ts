import * as allSettled from "promise.allsettled"
import { Telegram } from "telegraf"
import { MyUser, SendFunction } from "./typings"
import * as utils from "./utils"

export default class Admin {
    id: number
    recipients: MyUser[] = []
    telegram: Telegram

    constructor(id: number, telegram: Telegram) {
        this.id = id
        this.telegram = telegram
    }

    async sendMessage(text: string) {
        await this._sendMessage(this.id, text)
    }

    async sendFile(fileId: string, sendFunc: SendFunction) {
        await sendFunc.call(this.telegram, this.id, fileId)
    }

    async sendMessageToRecipients(text: string) {
        const { recipients, _sendMessage } = this
        await allSettled(
            recipients.map((recipient) => _sendMessage(recipient.id, text))
        )
    }

    async sendFileToRecipients(fileId: string, sendFunc: SendFunction) {
        const { recipients, telegram } = this
        await allSettled(
            recipients.map((recipient) =>
                sendFunc.call(telegram, recipient.id, fileId)
            )
        )
    }

    async setRecipientsByNames(names: string[], users: MyUser[]) {
        const userNames = users.map((user) => user.name)
        const results = await Promise.all(
            names.map((name) => utils.fuzzySearch(name, userNames))
        )
        this.recipients = results
            .filter((result) => !!result)
            .map((name) => users.find((user) => user.name === name)!)
    }

    setRecipients(users: MyUser[]) {
        this.recipients = users
    }

    _sendMessage = (id: number, text: string) => {
        return this.telegram.sendMessage.call(this.telegram, id, text, {
            parse_mode: "Markdown",
        })
    }
}
