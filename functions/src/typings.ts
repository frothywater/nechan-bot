import { Context } from "telegraf"
import { InputFile } from "telegraf/typings/core/types/typegram"
import { MessageSubType } from "telegraf/typings/telegram-types"
import { Message } from "typegram"
import Admin from "./admin"

export interface MyContext extends Context {
    admin?: Admin
}

export interface MyUser {
    id: number
    name: string
}

export type TelegramSendFunc = (
    chatId: number | string,
    file: string | InputFile,
    extra?: any
) => Promise<Message>

export type MySupportedFileType = (
    | "sticker"
    | "photo"
    | "audio"
    | "animation"
    | "voice"
    | "video"
) &
    MessageSubType
export const supportedFileTypes: MySupportedFileType[] = [
    "sticker",
    "photo",
    "audio",
    "animation",
    "voice",
    "video",
]

export interface FileFuncRelation {
    getFileIDFunc: (ctx: MyContext) => string | undefined
    sendFunc: TelegramSendFunc
}

export type FileFuncRelationTable = {
    [type in MySupportedFileType]: FileFuncRelation
}
