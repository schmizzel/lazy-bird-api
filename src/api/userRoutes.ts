import express from 'express'
import { Request, Response } from 'express';
import { authenticateUser, createUser, getUser } from '../service/user'
import { HTTP_SUCCESS, pool, sendMappedError } from './common';
import { BadRequestError } from '../errors';
import { authenticate } from './middleware';
import { Maybe } from 'monet';
import { deleteFollowerRelation, storeFollowerRelation } from '../data/storage';

/**
 * Defines all routes necessary for authorization. 
 */
export const authRouter = express.Router()

/**
 * Defines all users/ routes. Requires all requests to be authenticated.
 */
export const userRouter = express.Router()
userRouter.use(authenticate)

/**
 * Create a new user.
 */
authRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body
  
  const err = validateSignUpRequest(body)
  if (err.isSome()) {
    sendMappedError(res, err.some())
    return
  }

  const details = {
    username: body.username, 
    icon_id: body.iconId, 
    display_name: body.displayName,
  }

  createUser(pool, details, body.password)
  .then(token => {
    res.json(token)
  })
  .catch(err => sendMappedError(res, err))
})

/** 
 * Authenticate a user.
 */
authRouter.post('/auth', async (req: Request, res: Response) => {
  const body = req.body
  
  const err = validateAuthRequest(body)
  if (err.isSome()) {
    sendMappedError(res, err.some())
    return
  }

  authenticateUser(pool, body.username, body.password)
  .then(token => {
    res.json(token)
  })
  .catch(err => sendMappedError(res, err))  
})

/** 
 * Get the user with the given ID.
 */
userRouter.get('/:username', async (req: Request, res: Response) => {
  const username = (req.params.username === 'me') ? req.body.username : req.params.username
  
  getUser(pool, username)
    .then(user => res.json(user))
    .catch(err => sendMappedError(res, err))
})

/** 
 * Follow the given user.
 */
userRouter.post('/:username/follow', async (req: Request, res: Response) => {  
  const username = req.body.username
  const followsUsername = req.params.username

  if (username === followsUsername) {
    sendMappedError(res, new BadRequestError('user cannot follow itself'))
    return
  }

  storeFollowerRelation(pool, username, followsUsername)
    .then(() => res.sendStatus(HTTP_SUCCESS))
    .catch(err => sendMappedError(res, err))
})

/** 
 * Unfollow the given user.
 */
 userRouter.delete('/:username/follow', async (req: Request, res: Response) => {
  const username = req.body.username
  const followsUsername = req.params.username
  
  deleteFollowerRelation(pool, username, followsUsername)
    .then(() => res.sendStatus(HTTP_SUCCESS))
    .catch(err => sendMappedError(res, err))
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateSignUpRequest(body: any): Maybe<BadRequestError> {
  if (!body.username) {
    return Maybe.Some(new BadRequestError('username must not be empty'))
  }

  if (!body.password) {
    return Maybe.Some(new BadRequestError('password must not be empty'))
  }

  if (!body.iconId) {
    return Maybe.Some(new BadRequestError('iconId must not be empty'))
  }

  return Maybe.None()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAuthRequest(body: any): Maybe<BadRequestError> {
  if (!body.username) {
    return Maybe.Some(new BadRequestError('username must not be empty'))
  }

  if (!body.password) {
    return Maybe.Some(new BadRequestError('password must not be empty'))
  }

  return Maybe.None()
}
