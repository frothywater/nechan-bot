import * as fuzz from "fuzzball"
import * as _ from "lodash"
import { Message, User } from "typegram"
import { MyUser } from "./typings"

export const welcomeSentence = "我喜欢可爱的小弟弟。"

export function fullName(user: User): string {
    let result = user.first_name
    if (user.last_name) result += " " + user.last_name
    return result
}

export function namesInCommand(str: string): string[] {
    if (str.indexOf(" ") < 0) return []
    return str.slice(str.indexOf(" ")).trim().split(" ")
}

export function usersLog(users: MyUser[]): string {
    return "*Users:*\n" + usersToString(users)
}

export function currentRecipientsLog(users: MyUser[]): string {
    return `✅ _Current recipients:_\n *${usersToString(users)}*`
}

export function errorLog(error: unknown): string {
    return `⚠ _Error: ${error}_`
}

export function userComingTextLog(message: Message.TextMessage): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return `*${fullName(message.from!)}:*\n${message.text}`
}

export function userComingFileLog(message: Message, fileType: string): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return `*${fullName(message.from!)}* sent _${fileType}_:`
}

export function sentTextLog(users: MyUser[], text: string): string {
    return `✅ _Sent to_ *${usersToString(users)}*:\n${text}`
}

export function sentFileLog(users: MyUser[]): string {
    return `✅ _Sent file to_ *${usersToString(users)}*.`
}

export async function fuzzySearch(
    value: string,
    choices: string[],
    threshold = 80
): Promise<string | undefined> {
    const result = await fuzz.extractAsPromised(value, choices, {
        scorer: fuzz.partial_token_sort_ratio,
        returnObjects: true,
    })
    const maxItem = _.maxBy(result, (item) => item.score)
    if (!maxItem) return undefined
    if (maxItem.score >= threshold) return maxItem.choice
    else return undefined
}

function usersToString(users: MyUser[]): string {
    return users.map((user) => user.name).join(", ")
}
