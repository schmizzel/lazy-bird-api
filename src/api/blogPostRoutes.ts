import express from 'express'
import { Request, Response } from 'express';
import { Either } from 'monet'
import { GenerationParameters } from '../data/models';
import { BadRequestError } from '../errors';
import { createPost } from '../service/post';
import { pool, sendMappedError } from './common';
import { authenticate } from './middleware';

/**
 * Defines all posts/ routes. Requires all requests to be authenticated.
 */
export const postsRouter = express.Router()
postsRouter.use(authenticate)

/**
 * Create a new post.
 */
postsRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body
  
  // TODO: Validate request (content set)

  parseGenerationParameters(body)
  .cata(
    err => sendMappedError(res, err),
    params => {
      createPost(pool, body.username, body.content, params)
        .then(post => res.json(post))
        .catch(err => sendMappedError(res, err))
    }
  )
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGenerationParameters(body: any): Either<BadRequestError, GenerationParameters | undefined> {
  if (!body.shouldAutoComplete) {
    return Either.right(undefined)
  }
 
  if (!body.temperature) {
    return Either.left(new BadRequestError('temperature must not be undefined if shouldAutoComplete == true'))
  }

  const params = {
    temperature: body.temperature, // TODO: Check whether temperature is number
    mood: body.mood ?? 'neutral',
  }

  return Either.right(params)
}
