/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('../../lib/helper.js');

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
function healthCheck(req, res, next) {
  serviceHelper.log('trace', 'healthCheck', 'Health check API called');
  const activeServices = [];
  let activeCount = 0;
  let results;
  let dbClient;

  (async () => {
    try {
      const SQL = 'SELECT service_name, ip_address, port FROM services WHERE active';
      serviceHelper.log('trace', 'healthCheck', 'Connect to data store connection pool');
      dbClient = await global.logDataClient.connect(); // Connect to data store
      serviceHelper.log('trace', 'healthCheck', 'Get list of active services');
      results = await dbClient.query(SQL);
      serviceHelper.log('trace', 'healthCheck', 'Release the data store connection back to the pool');
      await dbClient.release(); // Return data store connection back to pool

      if (results.rowCount === 0) {
        serviceHelper.log('trace', 'healthCheck', 'No active services running');
      }

      // Loop through services and call their health check end point
      let apiURL;
      let healthCheckData;
      let loopCounter = results.rowCount;

      results.rows.forEach(async (serviceInfo) => {
        try {
          apiURL = `https://${serviceInfo.ip_address}:${serviceInfo.port}/ping`;
          serviceHelper.log('trace', 'healthCheck', `Calling: ${apiURL}`);
          healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);

          loopCounter -= 1;
          if (healthCheckData.body.sucess === 'true') {
            activeServices.push(healthCheckData.body.data);
            activeCount += 1;
          }

          apiURL = null;
          healthCheckData = null;

          if (loopCounter === 1) {
            const returnJSON = {
              activeCount,
              activeServices,
            };

            serviceHelper.sendResponse(res, true, returnJSON);
            next();
          }
        } catch (err) {
          serviceHelper.log('error', 'healthCheck', err);
          apiURL = null;
          healthCheckData = null;
        }
      });
    } catch (err) {
      serviceHelper.log('error', 'healthCheck', err);
    }
  })().catch((err) => {
    serviceHelper.log('error', 'healthCheck', err);
    return false;
  });
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
