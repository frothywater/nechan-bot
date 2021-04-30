import { ContextMessageUpdate } from "telegraf"
import { InputFile } from "telegraf/typings/telegram-types"
import Admin from "./admin"

export interface MyUser {
    id: number
    name: string
}

export interface SendFunction {
    (chatId: number | string, file: InputFile, extra?: any): Promise<any>
}

export interface MyContext extends ContextMessageUpdate {
    admin?: Admin
}

export interface FileRelations {
    [type: string]: {
        fileId: (ctx: MyContext) => string | undefined
        sendFunc: SendFunction
    }
}
