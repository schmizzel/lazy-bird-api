import { assert } from 'chai'
import 'mocha'
import { Pool } from 'pg'
import { PostMeta, User } from './models';
import { getFollowedUsernames, storeFollowerRelation, storeUser } from './userStorage'
import { queryPosts, storePost } from './postStorage'
import migrate from 'node-pg-migrate'

let pool: Pool
let databaseName: string

before(() => createTestingDatabase().then(writeTestData).catch(e => assert.fail(e)))

after(() => teardownTestingDatabase().catch(err => console.error('failed to teardown database', err)))

describe('queryPosts', function() {
  it('page filter works as expected', async function() {
    try {
      const page = {
        date: samplePosts[2].timestamp,
        id: samplePosts[2].id,
      }
      const got = await queryPosts(pool, 2, { page })
      const want = [samplePosts[2], samplePosts[3]]
      assert.deepEqual(got, want)
    } catch(e) {
      assert.fail(e)
    }
  });
  it('user filter works as expected', async function() {
    try {
      const got = await queryPosts(pool, 2, { usernames: [sampleUser1.username] })      
      const want = [samplePosts[0], samplePosts[2]]
      assert.deepEqual(got, want)
    } catch(e) {
      assert.fail(e)
    }
  });
  it('user and page filter work together as expected', async function() {
    try {
      const page = {
        date: samplePosts[2].timestamp,
        id: samplePosts[2].id,
      }
      const got = await queryPosts(pool, 2, { page, usernames: [sampleUser1.username] })      
      const want = [samplePosts[2]]
      assert.deepEqual(got, want)
    } catch(e) {
      assert.fail(e)
    }
  });
});

describe('getFollowedUsernames', function() {
  it('happy path', async function() {
    try {
      const got = await getFollowedUsernames(pool, sampleUser1.username)
      const want = [sampleUser2.username]
      assert.deepEqual(got, want)
    } catch(e) {
      assert.fail(e)
    }
  });
  it('empty response', async function() {
    try {
      const got = await getFollowedUsernames(pool, sampleUser2.username)
      const want = []
      assert.deepEqual(got, want)
    } catch(e) {
      assert.fail(e)
    }
  });
});


const sampleUser1: User = {  
  icon_id: '1',
  username: 'Biggus',
  display_name: 'Dickus'
}

const sampleUser2: User = {  
  icon_id: '2',
  username: 'Chuck',
  display_name: 'Chuck Norris'
}

const samplePosts: PostMeta[] = [
  {
    id: '1',
    auto_complete: false,
    content: 'Seife, Seife, was ist Seife?',
    timestamp: new Date(Date.UTC(2022, 11, 4)),
    comments: [],
    likes: 0,
    user: sampleUser1,
  },
  {
    id: '2',
    auto_complete: true,
    content: 'Das Ablecken von Türknöpfen ist auf anderen Planeten illegal.',
    timestamp: new Date(Date.UTC(2022, 11, 3)),
    comments: [],
    likes: 0,
    user: sampleUser2,
    
  },
  {
    id: '3',
    auto_complete: false,
    content: 'Nein, hier ist Patrick.',
    timestamp: new Date(Date.UTC(2022, 11, 2)),
    comments: [],
    likes: 0,
    user: sampleUser1,
  },
  {
    id: '4',
    auto_complete: false,
    content: 'Meine geistig moralischen Mechanismen sind mysteriös und komplex.',
    timestamp: new Date(Date.UTC(2022, 11, 1)),
    comments: [],
    likes: 0,
    user: sampleUser2,
  },
]

async function writeTestData() {
  try {
    await storeUser(pool, sampleUser1, 'secret')
    await storeUser(pool, sampleUser2, 'secret')
    await storeFollowerRelation(pool, sampleUser1.username, sampleUser2.username)
    samplePosts.forEach(async (post) => {
      await storePost(pool, post, post.user.username)
    })
  } catch(e) {
    assert.fail(e)
  }
}

/**
 * Create an empty testing database for testing.
 * @returns a pg Pool connected to the testing database and the database name
 */
async function createTestingDatabase() {
  const config = defaultConfig()
  
  const client = new Pool(config)

  databaseName = randomDBname(10)
  await client.query(`CREATE DATABASE ${databaseName};`)
  config.database = databaseName

  await migrate({
    databaseUrl: config,
    migrationsTable: 'pgmigrations',
    dir: 'migrations/',
    direction: 'up'
  })

  pool = new Pool(config)

  // Wait until database is ready
  // await new Promise(resolve => setTimeout(resolve, 10))
}

async function teardownTestingDatabase() {
  await pool.end()
  const mainPool = new Pool(defaultConfig());
  await mainPool.query(`DROP DATABASE ${databaseName}`)
}

function randomDBname(length: number): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

function defaultConfig() {
  return {
    database: 'postgres',
    host: 'localhost',
    user: 'postgres',
    port: 5432,
    password: 'secret',
  }
}