import { Telegram } from "telegraf"
import { Message } from "typegram"
import { FileFuncRelationTable } from "./typings"

export default function fileFuncRelationTable(
    telegram: Telegram
): FileFuncRelationTable {
    return {
        sticker: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.StickerMessage).sticker.file_id,
            sendFunc: telegram.sendSticker,
        },
        photo: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.PhotoMessage).photo.pop()?.file_id,
            sendFunc: telegram.sendPhoto,
        },
        audio: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.AudioMessage).audio.file_id,
            sendFunc: telegram.sendAudio,
        },
        animation: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.AnimationMessage).animation.file_id,
            sendFunc: telegram.sendAnimation,
        },
        voice: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.VoiceMessage).voice.file_id,
            sendFunc: telegram.sendVoice,
        },
        video: {
            getFileIDFunc: (ctx) =>
                (ctx.message as Message.VideoMessage).video.file_id,
            sendFunc: telegram.sendVideo,
        },
    }
}
