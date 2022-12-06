import express from 'express'
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express'
import {makeExecutableSchema, addResolveFunctionsToSchema} from 'graphql-tools'
import path from 'path'
import aws from 'aws-sdk'
import shortid from 'shortid'
import bodyParser from 'body-parser'
import {get, last, map} from 'lodash'
import {readFileSync} from 'fs'
import resolvers from './resolvers'
import {requireUser} from './auth'


const typeDefs = readFileSync('./backend/schema.gql').toString()
const schema = makeExecutableSchema({typeDefs, resolvers})
addResolveFunctionsToSchema(schema, {});

const admin = express.Router()

admin.use('/api/graphql', requireUser, bodyParser.json(), graphqlExpress(req => ({
  schema,
  rootValue: req,
  formatError: error => {
    let originalErrors = get(error, 'originalError.errors')
    let errors = {}
    if (originalErrors) {
      Object.keys(originalErrors).forEach(field => {
        errors[field] = originalErrors[field].message
      })
    }
    console.error(error)
    return {
      message: error.message,
      errors,
      stack: error.stack,
    }
  },
})))

admin.use('/graphiql', graphiqlExpress({endpointURL: '/admin/api/graphql'}))

// Redact signed upload endpoint
admin.get('/api/sign-s3', requireUser, async (req, res) => {
  const s3 = new aws.S3({region: 'eu-west-1'})
  const ext = last(req.query.name.split('.'))
  const fileName = `${req.site.key}/images/${shortid.generate()}.${ext}`
  const fileType = req.query.type
  const s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read',
  }
  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err)
      return res.end()
    }
    res.write(data)
    res.end()
  });
})

admin.use('/api/s3', require('react-dropzone-s3-uploader/s3router')({
  bucket: process.env.S3_BUCKET,
  // headers: {'Access-Control-Allow-Origin': '*'},  // optional
  ACL: 'public-read',
  getFileKeyDir: req => {
    return `${req.site.key}/files`
  }
}));

admin.get('/api/images', requireUser, async (req, res) => {
  const {type, id} = req.query
  const klass = require('./models')[type]
  if (!klass) {
    console.log(`No model found for ${type}`)
    res.sendStatus(500)
  }
  const object = await klass.findById(id)
  res.json(map(object.images, url => ({
    thumb: url,
    url,
    id: url,
  })))
})

if (process.env.NODE_ENV === 'production') {
  admin.use(express.static(path.resolve(__dirname, '../build-admin')))
  admin.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../build-admin/index.html'))
  })
}

export default admin
