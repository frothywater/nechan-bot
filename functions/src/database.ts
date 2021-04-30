import { MyUser } from "./typings"

export default class Database {
    users: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>

    constructor(db: FirebaseFirestore.Firestore) {
        this.users = db.collection("users")
    }

    async getUsers(): Promise<MyUser[]> {
        const snapshot = await this.users.get()
        const result: MyUser[] = []

        snapshot.forEach((doc) =>
            result.push({
                id: doc.data().id,
                name: doc.data().name,
            })
        )

        return result
    }

    async addUser(user: MyUser): Promise<void> {
        await this.users.doc(user.name).set(user)
    }

    async getNameById(id: number): Promise<string | undefined> {
        const snapshot = await this.users.where("id", "==", id).get()
        if (snapshot.empty) return undefined
        return snapshot.docs[0].data().name
    }
}
