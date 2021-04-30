import { Telegram } from "telegraf"
import { FileRelations, MyContext } from "./typings"

export default function fileTable(telegram: Telegram): FileRelations {
    return {
        sticker: {
            fileId: (ctx: MyContext) => ctx.message?.sticker?.file_id,
            sendFunc: telegram.sendSticker,
        },
        photo: {
            fileId: (ctx: MyContext) => ctx.message?.photo?.pop()?.file_id,
            sendFunc: telegram.sendPhoto,
        },
        audio: {
            fileId: (ctx: MyContext) => ctx.message?.audio?.file_id,
            sendFunc: telegram.sendAudio,
        },
        animation: {
            fileId: (ctx: MyContext) => ctx.message?.animation?.file_id,
            sendFunc: telegram.sendAnimation,
        },
        voice: {
            fileId: (ctx: MyContext) => ctx.message?.voice?.file_id,
            sendFunc: telegram.sendVoice,
        },
        video: {
            fileId: (ctx: MyContext) => ctx.message?.video?.file_id,
            sendFunc: telegram.sendVideo,
        },
    }
}
