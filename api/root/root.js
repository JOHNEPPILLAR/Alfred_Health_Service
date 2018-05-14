/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('../../lib/helper.js');
const { Client } = require('pg');

const skill = new Skills();

/**
 * @api {get} /ping
 * @apiName ping
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     sucess: 'true'
 *     data: 'pong'
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
function ping(req, res, next) {
  serviceHelper.log('trace', 'ping', 'Ping API called');

  const ackJSON = {
    service: process.env.ServiceName,
    reply: 'pong',
    cpu: serviceHelper.getCpuInfo(),
    mem: serviceHelper.getMemoryInfo(),
    os: serviceHelper.getOsInfo(),
    process: serviceHelper.getProcessInfo(),
  };

  serviceHelper.sendResponse(res, true, ackJSON);
  next();
}
skill.get('/ping', ping);

/**
 * @api {get} /healthcheck
 * @apiName healthcheck
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     sucess: 'true'
 *     data: {
 *       activeCount: 0
 *     }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
async function healthCheck(req, res, next) {
  serviceHelper.log('trace', 'healthCheck', 'Health check API called');
  const activeServices = [];
  let activeCount = 0;

  try {
    const serviceClient = new Client({
      host: process.env.DataStore,
      database: 'logs',
      user: process.env.DataStoreUser,
      password: process.env.DataStoreUserPassword,
      port: 5432,
    });

    // Get list of registered services
    const SQL = 'SELECT service_name, ip_address, port FROM services WHERE active';
    serviceHelper.log('trace', 'healthCheck', 'Get list of active services');
    await serviceClient.connect(); // Connect to data store
    const servicesData = await serviceClient.query(SQL);
    await serviceClient.end(); // Close data store connection

    if (servicesData.rowCount === 0) {
      serviceHelper.log('trace', 'healthCheck', 'No active services running');
    }

    // Loop through services and call their health check end point
    let apiURL;
    let healthCheckData;
    servicesData.rows.forEach(async (serviceInfo) => {
      try {
        apiURL = `http://${serviceInfo.ip_address}:${serviceInfo.port}/ping`;
        healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
        activeCount += 1;
        activeServices.push(healthCheckData);
        apiURL = null;
        healthCheckData = null;
      } catch (err) {
        serviceHelper.log('error', 'healthCheck', err);
        apiURL = null;
        healthCheckData = null;
      }
    });

    const returnJSON = {
      activeCount,
      activeServices,
    };

    serviceHelper.sendResponse(res, true, returnJSON);
    next();
  } catch (err) {
    serviceHelper.log('error', 'healthCheck', err);
    serviceHelper.sendResponse(res, false, err);
    next();
  }
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
