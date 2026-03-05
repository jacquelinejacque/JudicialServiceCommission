import { Router, json } from 'express'
var router = Router()
import bodyParser from 'body-parser'
import _ from 'lodash'

import { dirname } from 'path'
import { fileURLToPath } from 'url'
//import authenticate from '../middleware/AuthMiddleware.js'
import UserHandler from './UserHandler.js'
import DisciplinaryRecordHandler from './DisciplinaryRecordHandler.js'
import HelpDeskHandler from './HelpDeskHandler.js'
// import ServiceHandler from './ServiceHandler.js'
// import InvoiceHandler from './InvoiceHandler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function init(app) {
  var self = this

  app.use(json({ limit: '50mb' }))
  app.use(bodyParser.json({ limit: '50mb' }))

  app.use(function (req, res, next) {
    //This line allows cross-site access from authorised headers
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With,accept, Content-Type,access-token,Authorization'
    )
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE')

    next()
  })
 
  router.use('/users', UserHandler)
  router.use('/disciplinaryRecords', DisciplinaryRecordHandler)
  router.use('/helpDesk', HelpDeskHandler)
//   router.use('/service', ServiceHandler)
//   router.use('/invoice', InvoiceHandler)

  router.all('/', function (request, res) {
    res.status(404)
    res.send({
      status: 404,
      title: 'Not Found',
      message: 'The resource you are looking for cannot be found',
    })
  })

  app.use((err, req, res, next) => {
    console.log('Error 500 : ', err.message)
    res.status(err.status || 500)

    res.send({
      status: 500,
      title: 'Internal Server Error: Size'.req.headers['content-length'],
      message:
        'An error occurred trying to process your request ' + err.message,
    })
    return
  })

  app.use(process.env['URL_PREFIX'], router)
}