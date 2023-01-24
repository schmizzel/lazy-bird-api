import { Either } from 'monet'
import { Pool } from 'pg'
import { v4 } from 'uuid'
import { PaginationParameters, PostMeta, Post, PostFilter, PageToken, AutoReply } from '../data/models'
import {
    deleteLikeRelation,
    getAutoReply,
    queryPosts,
    storeAutoReply,
    storeComment,
    storeLikeRelation,
    storePost
} from '../data/postStorage'
import { getFollowedUsernames } from '../data/userStorage'
import { BadRequestError } from '../errors'
import { logger } from '../logger'
import { createInContextPost } from './postGeneraton'
import { publish } from './pubsub'

export async function createPost(
    pool: Pool, 
    username: string, 
    content: string, 
    autoComplete: boolean, 
    autoReply?: AutoReply
): Promise<Post> {

    const post: Post = {
        id: v4(),
        content: content,
        auto_complete: autoComplete,
        timestamp: new Date(),
    }

    await storePost(pool, post, username)
    
    if (autoReply) {
        await storeAutoReply(pool, post.id, autoReply)
    }

    return post
}

export async function createComment(pool: Pool, input: {username: string, postId: string, content: string}) {
    const comment = {
        id: v4(),
        timestamp: new Date(),
        ...input,
    }
    
    await storeComment(pool, comment)
    publish(input.postId)

    const autoReply = await getAutoReply(pool, input.postId)
    if (autoReply) {
        createAutoReply(pool, autoReply)
    }
}

/**
 * Either add or remove a like by the given user on the given post.
 */
export async function setPostIsLiked(pool: Pool, input: {username: string, postId: string, isLiked: boolean}) {
    if (input.isLiked) {
        await storeLikeRelation(pool, input.username, input.postId)
    } else {
        await deleteLikeRelation(pool, input.username, input.postId)
    }

    publish(input.postId)
}

export async function listPosts(
    pool: Pool, 
    filter: PostFilter, 
    pagination: PaginationParameters
): Promise<{posts: PostMeta[], nextPageToken: string}> {

    const query = {
        usernames: filter.usernames,
        page: undefined,
    }
    
    if (pagination.token) {
        decodePageToken(pagination.token)
        .cata(
            err => { throw err }, 
            page => { query.page = page }
        )
    }

    const posts = await queryPosts(pool, pagination.size + 1, query)

    let nextPageToken = ""
    if (posts.length > pagination.size) {
        const nextEntry = posts.pop()
        posts[posts.length - 1]
        nextPageToken = encodePageToken({
            date: nextEntry.timestamp,
            id: nextEntry.id
        })
    }

    return {
        nextPageToken: nextPageToken,
        posts: posts,
    }
}

export async function listUserFeed(pool: Pool, username: string, filter:PostFilter, pagination: PaginationParameters): Promise<{posts: PostMeta[], nextPageToken: string}> {
    let followed = await getFollowedUsernames(pool, username)
    followed.push(username)

    if (filter.usernames && filter.usernames.length > 0) {
        followed = followed.filter(username => filter.usernames.includes(username))
    }

    return listPosts(pool, { usernames: followed }, pagination)
}

async function createAutoReply(pool: Pool, autoReply: AutoReply) {
    //const context = [{"source": "me", "msg": post.content}, {"source": "you", "msg" : comment.content}]
    
    createInContextPost({temperature: autoReply.temperature, mood: autoReply.mood, context})
        .then(response => {
            // createComment(pool, )
        })
        .catch(err => logger.error("failed to create auto reply", err))
}

function encodePageToken(token: PageToken): string {
    const str = JSON.stringify(token)
    return Buffer.from(str).toString('base64')
}

function decodePageToken(token: string): Either<BadRequestError, PageToken> {
    try {
        const json = Buffer.from(token, 'base64').toString('binary')
        return Either.right(JSON.parse(json))
    } catch (e) {
        logger.error({
            message: 'failed to decode pageToken',
            pageToken: token,
            response: e,
        })

        return Either.left(new BadRequestError('invalid pageToken'))
    }
}
