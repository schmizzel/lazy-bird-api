import {BACKEND_HOST, AUTOCOMPLETE_PATH, IN_CONTEXT_PATH} from "../env";
import {post} from "./httpService";
import {CommentHistory, Mood, PostMeta} from "../data/models";
import { logger } from "../logger";

export async function createReply(temperature: number, mood:Mood, history: CommentHistory) {
    const url = BACKEND_HOST + IN_CONTEXT_PATH
    
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            context: history.history, 
            temperature, 
            mood,
        })
    })

    response.json().then(json => logger.info(json))
}

export async function createInContextPost(data): Promise<string>{
    const temperature = data.temperature
    const mood = data.mood
    const context = data.context
    const payload = JSON.parse(JSON.stringify({
        "context": context,
        "temperature": temperature,
        "mood": mood
    }));

    const url = BACKEND_HOST + IN_CONTEXT_PATH
    return post(url, payload)
}

export async function complete(data: any): Promise<string>{
    const url = BACKEND_HOST + AUTOCOMPLETE_PATH
    //set this flag if our LM is to be used
    // data['ours'] = 'true'

    return post(url, data)
}

export function buildHistory(post: PostMeta, n: number) : CommentHistory  {
    const hist = {original : post.content, history: []}
    const comments = post.comments
    let i = comments.length
    do {
        --i
        if (i < 0){
            hist.history.push({"source": "me", "msg": hist.original})
            break
        }
        const source = comments[i].user.username == post.user.username ? "me" : "you"
        hist.history.push({"source": source, "msg": comments[i].content})

    } while (i > comments.length -n || comments[i].user.username != post.user.username)
    hist.history.reverse()

    return hist
}